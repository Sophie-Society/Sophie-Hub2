import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, apiError, ApiErrors, ErrorCodes } from '@/lib/api/response'
import { createLogger } from '@/lib/logger'
import * as staffService from '@/lib/services/staff.service'
import { z } from 'zod'

const log = createLogger('api:staff')

const QuerySchema = z.object({
  search: z.string().max(200).optional(),
  status: z.string().optional(),
  role: z.string().optional(),
  department: z.string().optional(),
  sort: z.enum(['full_name', 'created_at', 'role', 'hire_date']).optional().default('full_name'),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

/**
 * GET /api/staff
 * List staff with search, filter, sort, and pagination.
 */
export async function GET(request: Request): Promise<NextResponse> {
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
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    }

    const validation = QuerySchema.safeParse(params)
    if (!validation.success) {
      return apiError(ErrorCodes.VALIDATION_ERROR, validation.error.message, 400)
    }

    const result = await staffService.listStaff(validation.data)

    return apiSuccess(result, 200, {
      'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
    })
  } catch (error: unknown) {
    log.error('Failed to list staff', error)
    return ApiErrors.internal()
  }
}
