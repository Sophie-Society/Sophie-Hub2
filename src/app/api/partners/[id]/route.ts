import { getAdminClient } from '@/lib/supabase/admin'
import { requireAuth, canAccessPartner } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { deduplicateLineage, type FieldLineageRow } from '@/types/lineage'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:partners')

const supabase = getAdminClient()

/**
 * GET /api/partners/[id]
 *
 * Get a single partner with assignments, ASINs, and recent weekly statuses.
 * Runs 4 queries in parallel for performance.
 * Requires authentication and partner access check (admin or assigned staff).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  try {
    const { id } = await params

    // Verify the user has access to this specific partner
    const hasAccess = await canAccessPartner(auth.user.id, auth.user.role, id)
    if (!hasAccess) {
      return ApiErrors.forbidden('You do not have access to this partner')
    }

    // Run all queries in parallel
    const [partnerResult, assignmentsResult, asinsResult, statusesResult, lineageResult] = await Promise.all([
      // Cat-4: .maybeSingle() — partner might not exist for given id; C-8: filter soft-deleted rows
      supabase
        .from('partners')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle(),
      supabase
        .from('partner_assignments')
        .select('id, assignment_role, is_primary, assigned_at, staff:staff_id(id, full_name, email, role)')
        .eq('partner_id', id)
        .is('unassigned_at', null)
        .order('assignment_role'),
      // C-8: filter soft-deleted ASINs
      supabase
        .from('asins')
        .select('id, asin_code, title, status, is_parent')
        .eq('partner_id', id)
        .is('deleted_at', null)
        .order('asin_code'),
      supabase
        .from('weekly_statuses')
        .select('id, week_start_date, status, notes')
        .eq('partner_id', id)
        .order('week_start_date', { ascending: false })
        .limit(156), // 3 years of weekly data for the Weekly Status tab
      supabase
        .from('field_lineage')
        .select('field_name, source_type, source_ref, previous_value, new_value, changed_at, sync_run_id')
        .eq('entity_type', 'partners')
        .eq('entity_id', id)
        .order('changed_at', { ascending: false }),
    ])

    // H-6: check errors on all parallel queries before using data
    if (partnerResult.error) {
      log.error('Failed to fetch partner', { err: partnerResult.error, partnerId: id })
      return ApiErrors.database()
    }

    if (!partnerResult.data) {
      return ApiErrors.notFound('Partner')
    }

    if (assignmentsResult.error) {
      // Non-fatal: log and fall back to empty list so the partner detail page still loads
      log.warn('Failed to fetch partner assignments', { err: assignmentsResult.error, partnerId: id })
    }

    if (asinsResult.error) {
      log.warn('Failed to fetch partner ASINs', { err: asinsResult.error, partnerId: id })
    }

    if (statusesResult.error) {
      log.warn('Failed to fetch partner weekly statuses', { err: statusesResult.error, partnerId: id })
    }

    if (lineageResult.error) {
      log.warn('Failed to fetch partner field lineage', { err: lineageResult.error, partnerId: id })
    }

    // Deduplicate lineage to get most recent per field
    const lineage = deduplicateLineage((lineageResult.data || []) as FieldLineageRow[])

    return apiSuccess({
      partner: {
        ...partnerResult.data,
        assignments: assignmentsResult.data || [],
        asins: asinsResult.data || [],
        recent_statuses: statusesResult.data || [],
        lineage,
      },
    })
  } catch (error) {
    log.error('Unexpected error in GET /api/partners/[id]', error)
    return ApiErrors.internal()
  }
}
