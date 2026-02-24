import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:sync:status')

const supabase = getAdminClient()

/**
 * GET /api/sync/status
 *
 * Returns the count of currently running syncs.
 * Used by the UI polling mechanism to detect when syncs complete
 * even if the original fetch response is lost (long-running requests).
 */
export async function GET(): Promise<NextResponse> {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  try {
    const { count, error } = await supabase
      .from('sync_runs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'running')

    if (error) {
      log.error('Error checking sync status', error)
      return ApiErrors.database(error.message)
    }

    return apiSuccess({
      running_syncs: count || 0,
    }, 200, {
      'Cache-Control': 'no-store',
    })
  } catch (error) {
    log.error('Error in GET /api/sync/status', error)
    return ApiErrors.internal()
  }
}
