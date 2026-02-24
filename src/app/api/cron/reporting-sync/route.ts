/**
 * POST /api/cron/reporting-sync
 *
 * Vercel cron handler for daily BigQuery → Supabase reporting sync.
 * Scheduled daily at 2 AM UTC via vercel.json.
 *
 * 1. Verifies CRON_SECRET for authentication
 * 2. Loads all enabled sync configs from rpt_sync_config
 * 3. Syncs dimension tables (full refresh) then fact tables (incremental)
 * 4. Stops gracefully at 8.5 min to stay under Vercel's 10 min limit
 * 5. Returns summary of all table sync results
 */

import { NextRequest, NextResponse } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api/response'
import { getReportingSyncEngine } from '@/lib/reporting-sync'
import { createLogger } from '@/lib/logger'

const log = createLogger('cron:reporting-sync')

export const maxDuration = 600 // 10 minutes (Vercel Pro plan)

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    log.error('CRON_SECRET is not configured')
    return apiError('INTERNAL_ERROR', 'Cron secret is not configured', 500)
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return apiError('UNAUTHORIZED', 'Invalid cron secret', 401)
  }

  const startTime = Date.now()

  try {
    log.info('Starting daily reporting sync')

    const engine = getReportingSyncEngine()
    const summary = await engine.syncAll('cron')

    const durationMs = Date.now() - startTime

    log.info('Daily reporting sync complete', {
      durationSec: Math.round(durationMs / 1000),
      tablesSucceeded: summary.tables_succeeded,
      totalTables: summary.total_tables,
      tablesFailed: summary.tables_failed,
      totalRows: summary.total_rows,
    })

    return apiSuccess({
      ...summary,
      trigger: 'cron',
    })
  } catch (error: unknown) {
    const durationMs = Date.now() - startTime
    const message = error instanceof Error ? error.message : String(error)
    log.error('Reporting sync cron failed', { err: error, durationMs })

    return apiError(
      'INTERNAL_ERROR',
      `Reporting sync cron failed: ${message}`,
      500
    )
  }
}
