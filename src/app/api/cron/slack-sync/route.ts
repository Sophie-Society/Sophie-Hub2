/**
 * POST /api/cron/slack-sync
 *
 * Vercel cron handler for chunked message sync.
 * Scheduled every 5 minutes. Each invocation:
 * 1. Finds the active sync run (status = 'running' or 'pending')
 * 2. Claims the lease (anti-overlap protection)
 * 3. Processes the next batch of channels
 * 4. Updates run progress
 *
 * If no active run exists, exits immediately (no-op).
 *
 * @see src/docs/SLACK-ROLLOUT-PLAN.md §2.4 for architecture
 */

import { NextRequest, NextResponse } from 'next/server'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'
import { processChunk } from '@/lib/slack/sync'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:cron:slack-sync')

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError(ErrorCodes.UNAUTHORIZED, 'Invalid cron secret', 401)
  }

  const startTime = Date.now()

  try {
    const supabase = getAdminClient()

    // Find active sync run
    const { data: activeRun, error: runError } = await supabase
      .from('slack_sync_runs')
      .select('id, status')
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (runError) {
      log.error('Error finding active run', runError)
      return apiError(ErrorCodes.DATABASE_ERROR, 'Failed to find active sync run', 500)
    }

    if (!activeRun) {
      // No active run — nothing to do
      return apiSuccess({ status: 'no_active_run', duration_ms: Date.now() - startTime })
    }

    log.info(`Processing chunk for run ${activeRun.id} (status: ${activeRun.status})`)

    const summary = await processChunk(activeRun.id)
    const durationMs = Date.now() - startTime

    log.info(
      `Chunk complete in ${durationMs}ms — ` +
      `${summary.channels_synced} synced, ${summary.channels_failed} failed, ` +
      `${summary.total_messages} messages`
    )

    return apiSuccess({
      run_id: summary.run_id,
      channels_synced: summary.channels_synced,
      channels_failed: summary.channels_failed,
      total_messages: summary.total_messages,
      duration_ms: durationMs,
    })
  } catch (error: unknown) {
    const durationMs = Date.now() - startTime
    log.error(`Failed after ${durationMs}ms`, error)

    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      `Sync cron failed: ${error instanceof Error ? error.message : String(error)}`,
      500
    )
  }
}
