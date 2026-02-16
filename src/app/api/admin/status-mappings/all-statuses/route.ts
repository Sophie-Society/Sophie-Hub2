/**
 * GET /api/admin/status-mappings/all-statuses
 *
 * Returns ALL unique weekly status values from partner data
 * with their assigned colors (admin only).
 */

import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { createLogger } from '@/lib/logger'
import * as adminService from '@/lib/services/admin.service'

const log = createLogger('api:admin:status-mappings:all-statuses')

export async function GET(): Promise<NextResponse> {
  const authResult = await requireRole(ROLES.ADMIN)
  if (!authResult.authenticated) return authResult.response

  try {
    const result = await adminService.getAllWeeklyStatusesCategorized()

    return apiSuccess(result, 200, {
      'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
    })
  } catch (error: unknown) {
    log.error('All statuses fetch error', error)
    return ApiErrors.internal()
  }
}
