/**
 * GET /api/modules
 *
 * List all enabled modules, ordered by sort_order.
 * All authenticated users can read modules.
 */

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:modules')

export async function GET(): Promise<NextResponse> {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  try {
    const supabase = getAdminClient()
    const { data: modules, error } = await supabase
      .from('modules')
      .select('*')
      .eq('enabled', true)
      .order('sort_order', { ascending: true })

    if (error) {
      log.error('Failed to fetch modules', error)
      return ApiErrors.database()
    }

    return apiSuccess({ modules: modules || [] })
  } catch (error: unknown) {
    log.error('Unexpected error fetching modules', error)
    return ApiErrors.internal()
  }
}
