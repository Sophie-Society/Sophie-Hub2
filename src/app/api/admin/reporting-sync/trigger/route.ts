/**
 * POST /api/admin/reporting-sync/trigger
 *
 * Manually trigger a reporting sync for a specific table or all tables.
 *
 * Body:
 *   { config_id: string }  - Sync a specific table
 *   { sync_all: true }     - Sync all enabled tables
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiValidationError, ApiErrors } from '@/lib/api/response'
import { getReportingSyncEngine } from '@/lib/reporting-sync'
import { createLogger } from '@/lib/logger'
import { z } from 'zod'

const log = createLogger('api:reporting-sync-trigger')

export const maxDuration = 600 // 10 minutes

const TriggerSchema = z.union([
  z.object({ config_id: z.string().uuid() }),
  z.object({ sync_all: z.literal(true) }),
])

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const body = await request.json()
    const validation = TriggerSchema.safeParse(body)

    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const engine = getReportingSyncEngine()

    if ('sync_all' in validation.data) {
      log.info('Manual sync-all triggered', { triggeredBy: auth.user.email })
      const summary = await engine.syncAll(auth.user.id)
      return apiSuccess({
        ...summary,
        trigger: 'manual',
        triggered_by: auth.user.email,
      })
    }

    log.info('Manual single-table sync triggered', {
      configId: validation.data.config_id,
      triggeredBy: auth.user.email,
    })
    const result = await engine.syncTableById(validation.data.config_id)
    return apiSuccess({
      ...result,
      trigger: 'manual',
      triggered_by: auth.user.email,
    })
  } catch (error: unknown) {
    log.error('Reporting sync trigger failed', { err: error })
    return ApiErrors.internal()
  }
}
