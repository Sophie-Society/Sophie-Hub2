import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors, apiError, ErrorCodes } from '@/lib/api/response'
import { deduplicateLineage } from '@/types/lineage'
import { createLogger } from '@/lib/logger'
import {
  findStaffById,
  findStaffAssignments,
  findStaffFieldLineage,
  updateStaff,
} from '@/lib/repositories/staff.repository'
import { z } from 'zod'

const log = createLogger('api:staff')

function normalizeStatusTag(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_')
}

function normalizeStatusTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const normalized = value
    .map((tag) => (typeof tag === 'string' ? normalizeStatusTag(tag) : ''))
    .filter(Boolean)

  return Array.from(new Set(normalized))
}

const StaffUpdateSchema = z.object({
  role: z.string().min(1).max(100).optional(),
  status: z.string().min(1).max(100).optional(),
  status_tags: z.array(z.string().min(1).max(64)).max(20).optional(),
}).refine(data => data.role !== undefined || data.status !== undefined || data.status_tags !== undefined, {
  message: 'At least one field is required',
})

/**
 * GET /api/staff/[id]
 *
 * Get a single staff member with partner assignments.
 * Runs queries in parallel for performance.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  try {
    const { id } = await params

    const [staffMember, assignments, lineageRows] = await Promise.all([
      findStaffById(id),
      findStaffAssignments(id),
      findStaffFieldLineage(id),
    ])

    if (!staffMember) {
      return ApiErrors.notFound('Staff member')
    }

    // Deduplicate lineage to get most recent per field
    const lineage = deduplicateLineage(lineageRows)

    return apiSuccess({
      staff: {
        ...staffMember,
        status_tags: normalizeStatusTags(staffMember.status_tags),
        assigned_partners: assignments,
        lineage,
      },
    })
  } catch (error) {
    log.error('Unexpected error in GET /api/staff/[id]', error)
    return ApiErrors.internal()
  }
}

/**
 * PATCH /api/staff/[id]
 *
 * Update editable staff fields from list/detail UI.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response
  if (auth.user.role !== 'admin') {
    return ApiErrors.forbidden('Only admins can update staff records')
  }

  try {
    const { id } = await params
    const body = await request.json()
    const parsed = StaffUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return apiError(ErrorCodes.VALIDATION_ERROR, parsed.error.message, 400)
    }

    const updates: Record<string, unknown> = {}
    if (parsed.data.role !== undefined) updates.role = parsed.data.role.trim()
    if (parsed.data.status !== undefined) updates.status = normalizeStatusTag(parsed.data.status)
    if (parsed.data.status_tags !== undefined) updates.status_tags = normalizeStatusTags(parsed.data.status_tags)

    const updated = await updateStaff(id, updates)

    if (!updated) {
      return ApiErrors.notFound('Staff member')
    }

    return apiSuccess({
      staff: {
        ...updated,
        status_tags: normalizeStatusTags(updated.status_tags),
      },
    })
  } catch (error) {
    log.error('Unexpected error in PATCH /api/staff/[id]', error)
    return ApiErrors.internal()
  }
}
