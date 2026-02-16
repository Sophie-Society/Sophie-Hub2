import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { createLogger } from '@/lib/logger'
import * as adminService from '@/lib/services/admin.service'

const log = createLogger('api:admin:settings')

/**
 * GET /api/admin/settings
 * Returns all system settings with masked values (admin only)
 */
export async function GET(): Promise<NextResponse> {
  const authResult = await requireRole(ROLES.ADMIN)
  if (!authResult.authenticated) return authResult.response

  try {
    const settings = await adminService.listMaskedSettings()
    return apiSuccess({ settings })
  } catch (error: unknown) {
    log.error('Failed to fetch settings', error)
    return ApiErrors.internal()
  }
}
