/**
 * POST /api/cron/slack-analytics
 *
 * Daily Vercel cron handler for computing Slack response time analytics.
 * Runs the rolling window computation: [today - LOOKAHEAD_DAYS, yesterday].
 *
 * Scheduled: daily at 6am UTC (configured in vercel.json)
 * Auth: CRON_SECRET bearer token (Vercel sets this automatically)
 */

import { NextRequest, NextResponse } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api/response'
import { computeDailyRollingWindow } from '@/lib/slack/analytics'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:cron:slack-analytics')

export async function POST(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    log.error('Slack analytics cron: CRON_SECRET is not configured')
    return apiError('INTERNAL_ERROR', 'Cron secret is not configured', 500)
  }

  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return apiError('UNAUTHORIZED', 'Invalid cron secret', 401)
  }

  const startTime = Date.now()

  try {
    log.info('Slack analytics cron: starting daily rolling window computation')

    const result = await computeDailyRollingWindow()
    const durationMs = Date.now() - startTime

    log.info(
      `Slack analytics cron: completed in ${durationMs}ms — ` +
      `${result.computed} computed, ${result.failed} failed`
    )

    return apiSuccess({
      computed: result.computed,
      failed: result.failed,
      errors: result.errors.length > 0 ? result.errors.slice(0, 10) : [],
      duration_ms: durationMs,
    })
  } catch (error) {
    const durationMs = Date.now() - startTime
    log.error(`Slack analytics cron: failed after ${durationMs}ms`, error)

    return apiError('INTERNAL_ERROR', 'Analytics cron failed', 500)
  }
}
