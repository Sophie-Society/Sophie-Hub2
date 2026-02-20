/**
 * POST /api/slack/sync/start
 *
 * Trigger a new sync run. Creates a sync_run record with status 'pending'
 * and returns the run_id immediately. The Vercel cron handler picks it up
 * and processes channels in chunks.
 */

import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiError, ApiErrors } from '@/lib/api/response'
import { createSyncRun } from '@/lib/slack/sync'
import { checkRateLimit, RATE_LIMITS, rateLimitHeaders } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:slack:sync:start')

export async function POST() {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  // Rate limit: 2 syncs per 5 minutes per user
  const rateCheck = checkRateLimit(auth.user.id, 'slack:sync', RATE_LIMITS.ADMIN_HEAVY)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { success: false, error: { code: 'RATE_LIMITED', message: 'Too many sync requests. Try again later.' } },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders(rateCheck),
          'Retry-After': Math.ceil(rateCheck.resetIn / 1000).toString(),
        },
      }
    )
  }

  try {
    const runId = await createSyncRun(auth.user.email)

    log.info(`Sync run started by ${auth.user.email}: ${runId}`)

    return apiSuccess({ run_id: runId }, 201)
  } catch (error) {
    // createSyncRun throws if a run is already in progress
    if (error instanceof Error && error.message.includes('already')) {
      return apiError('CONFLICT', 'A sync run is already in progress. Please wait for it to complete.', 409)
    }

    log.error('POST sync/start error', error)
    return ApiErrors.internal()
  }
}
