/**
 * GET /api/admin/reporting-sync/config
 *
 * Returns all reporting sync configurations for the admin UI.
 * Includes last sync status, row counts, and error info.
 */

import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:reporting-sync-config')
const supabase = getAdminClient()

export async function GET(): Promise<NextResponse> {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    // Full row needed: admin UI displays all config fields for monitoring
    const { data, error } = await supabase
      .from('rpt_sync_config')
      .select('*')
      .order('sync_strategy', { ascending: true })
      .order('table_name', { ascending: true })

    if (error) {
      log.error('Failed to fetch sync configs', { err: error.message })
      return ApiErrors.database(error.message)
    }

    return apiSuccess({ configs: data })
  } catch (error: unknown) {
    log.error('Unhandled error in reporting sync config', { err: error })
    return ApiErrors.internal()
  }
}
