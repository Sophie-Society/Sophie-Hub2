/**
 * GET /api/admin/status-mappings/unmapped
 *
 * Discovers status strings in partner data that don't match any mapping (admin only).
 */

import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { createLogger } from '@/lib/logger'
import * as adminService from '@/lib/services/admin.service'

const log = createLogger('api:admin:status-mappings:unmapped')

export async function GET(): Promise<NextResponse> {
  const authResult = await requireRole(ROLES.ADMIN)
  if (!authResult.authenticated) return authResult.response

  try {
    const result = await adminService.getUnmappedWeeklyStatuses()

    return apiSuccess(result, 200, {
      'Cache-Control': 'private, max-age=120, stale-while-revalidate=300',
    })
  } catch (error: unknown) {
    log.error('Unmapped statuses fetch error', error)
    return ApiErrors.internal()
  }
}
