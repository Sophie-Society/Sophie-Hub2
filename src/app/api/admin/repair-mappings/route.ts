/**
 * /api/admin/repair-mappings
 *
 * POST: Repair column_mappings with empty source_column values (admin only)
 * GET: Check how many mappings need repair without fixing them (admin only)
 */

import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { createLogger } from '@/lib/logger'
import * as adminService from '@/lib/services/admin.service'

const log = createLogger('api:admin:repair-mappings')

export async function POST(): Promise<NextResponse> {
  const auth = await requirePermission('data-enrichment:write')
  if (!auth.authenticated) return auth.response

  const rateLimit = checkRateLimit(auth.user.id, 'admin:repair-mappings:write', RATE_LIMITS.STRICT)
  if (!rateLimit.allowed) {
    return ApiErrors.rateLimited('Too many repair attempts. Please wait before trying again.')
  }

  try {
    const session = await getServerSession(authOptions)
    const accessToken = session?.accessToken as string | undefined

    if (!accessToken) {
      return ApiErrors.unauthorized('Google access token required - please sign in again')
    }

    const result = await adminService.repairMappings(accessToken)
    return apiSuccess(result)
  } catch (error: unknown) {
    log.error('Repair mappings error', error)
    return ApiErrors.internal()
  }
}

export async function GET(): Promise<NextResponse> {
  const auth = await requirePermission('data-enrichment:read')
  if (!auth.authenticated) return auth.response

  try {
    const result = await adminService.checkRepairStatus()
    return apiSuccess(result)
  } catch (error: unknown) {
    log.error('Repair mappings check error', error)
    return ApiErrors.internal()
  }
}
