import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, apiError, ApiErrors, ErrorCodes } from '@/lib/api/response'
import { findStaff, type StaffRecord } from '@/lib/repositories/staff.repository'
import { createLogger } from '@/lib/logger'
import { z } from 'zod'

const log = createLogger('api:staff')

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function extractGoogleSnapshotDate(
  sourceData: unknown,
  key: 'last_login_time' | 'last_seen_at'
): string | null {
  if (!isRecord(sourceData)) return null
  const googleWorkspace = sourceData.google_workspace
  if (!isRecord(googleWorkspace)) return null
  const snapshot = googleWorkspace.directory_snapshot
  if (!isRecord(snapshot)) return null
  const raw = snapshot[key]
  return typeof raw === 'string' && raw.trim().length > 0 ? raw : null
}

function toTimestamp(value: string | null | undefined): number | null {
  if (!value) return null
  const ts = Date.parse(value)
  return Number.isNaN(ts) ? null : ts
}

type StaffRow = {
  id: string
  full_name: string
  role: string | null
  status: string | null
  status_tags?: string[] | null
  hire_date: string | null
  created_at: string
  google_last_login_at?: string | null
}

function normalizeStatusTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const normalized = value
    .map((tag) => (typeof tag === 'string' ? tag.trim().toLowerCase().replace(/\s+/g, '_') : ''))
    .filter(Boolean)

  return Array.from(new Set(normalized))
}

function sortStaffRows(
  rows: StaffRow[],
  sort: 'full_name' | 'created_at' | 'role' | 'hire_date' | 'google_last_login_at',
  ascending: boolean
): StaffRow[] {
  return [...rows].sort((a, b) => {
    if (sort === 'google_last_login_at') {
      const aTs = toTimestamp(a.google_last_login_at)
      const bTs = toTimestamp(b.google_last_login_at)
      if (aTs === null && bTs === null) return 0
      if (aTs === null) return 1
      if (bTs === null) return -1
      return ascending ? aTs - bTs : bTs - aTs
    }

    if (sort === 'created_at' || sort === 'hire_date') {
      const aTs = toTimestamp(a[sort])
      const bTs = toTimestamp(b[sort])
      if (aTs === null && bTs === null) return 0
      if (aTs === null) return 1
      if (bTs === null) return -1
      return ascending ? aTs - bTs : bTs - aTs
    }

    const aValue = String(a[sort] ?? '').toLowerCase()
    const bValue = String(b[sort] ?? '').toLowerCase()
    return ascending ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
  })
}

const QuerySchema = z.object({
  search: z.string().max(200).optional(),
  status: z.string().optional(),
  role: z.string().optional(),
  department: z.string().optional(),
  sort: z.enum(['full_name', 'created_at', 'role', 'hire_date', 'google_last_login_at']).optional().default('full_name'),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
  inactive_days: z.coerce.number().int().min(1).max(3650).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

/**
 * GET /api/staff
 *
 * List staff with search, filter, sort, and pagination.
 *
 * Query params:
 * - search: string - Search full_name, email, staff_code
 * - status: string - Comma-separated status filter
 * - role: string - Comma-separated role filter
 * - department: string - Comma-separated department filter
 * - sort: 'full_name' | 'created_at' | 'role' | 'hire_date' | 'google_last_login_at'
 * - order: 'asc' | 'desc'
 * - inactive_days: number - Filter staff inactive for N+ days based on Google last login
 * - limit: number (1-100, default 50)
 * - offset: number (default 0)
 */
export async function GET(request: Request) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const params = {
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      role: searchParams.get('role') || undefined,
      department: searchParams.get('department') || undefined,
      sort: searchParams.get('sort') || undefined,
      order: searchParams.get('order') || undefined,
      inactive_days: searchParams.get('inactive_days') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    }

    const validation = QuerySchema.safeParse(params)
    if (!validation.success) {
      return apiError(ErrorCodes.VALIDATION_ERROR, validation.error.message, 400)
    }

    const { search, status, role, department, sort, order, inactive_days, limit, offset } = validation.data

    const needsComputedProcessing = sort === 'google_last_login_at' || inactive_days !== undefined
    const ascending = order === 'asc'

    let staffResult: { data: StaffRecord[]; count: number | null }
    try {
      staffResult = await findStaff({
        search,
        statuses: status ? status.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        roles: role ? role.split(',').map(r => r.trim()).filter(Boolean) : undefined,
        departments: department ? department.split(',').map(d => d.trim()).filter(Boolean) : undefined,
        sort,
        ascending,
        needsComputedProcessing,
        limit,
        offset,
      })
    } catch (err) {
      log.error('Error fetching staff', { err })
      return ApiErrors.database()
    }

    const { data: staff, count } = staffResult

    const normalizedStaff = (staff || []).map((member) => {
      const google_last_login_at = extractGoogleSnapshotDate(member.source_data, 'last_login_time')
      const google_last_seen_at = extractGoogleSnapshotDate(member.source_data, 'last_seen_at')
      return {
        ...member,
        status_tags: normalizeStatusTags(member.status_tags),
        google_last_login_at,
        google_last_seen_at,
      }
    })

    if (!needsComputedProcessing) {
      return apiSuccess({
        staff: normalizedStaff,
        total: count || 0,
        has_more: (count || 0) > offset + limit,
      }, 200, {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
      })
    }

    let processedRows = normalizedStaff as StaffRow[]

    if (inactive_days !== undefined) {
      const cutoff = Date.now() - (inactive_days * 24 * 60 * 60 * 1000)
      processedRows = processedRows.filter(member => {
        const ts = toTimestamp(member.google_last_login_at)
        return ts === null || ts < cutoff
      })
    }

    processedRows = sortStaffRows(processedRows, sort, ascending)

    const pagedRows = processedRows.slice(offset, offset + limit)
    const totalRows = processedRows.length

    return apiSuccess({
      staff: pagedRows,
      total: totalRows,
      has_more: totalRows > offset + limit,
    }, 200, {
      'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
    })
  } catch (error) {
    log.error('Unexpected error in GET /api/staff', error)
    return ApiErrors.internal()
  }
}
