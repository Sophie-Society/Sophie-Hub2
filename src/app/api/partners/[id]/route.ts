import { requireAuth, canAccessPartner } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { deduplicateLineage } from '@/types/lineage'
import { createLogger } from '@/lib/logger'
import {
  findPartnerById,
  findPartnerAssignmentsDetail,
  findPartnerAsins,
  findPartnerWeeklyStatuses,
  findPartnerFieldLineage,
} from '@/lib/repositories/partner.repository'

const log = createLogger('api:partners')

/**
 * GET /api/partners/[id]
 *
 * Get a single partner with assignments, ASINs, and recent weekly statuses.
 * Runs queries in parallel for performance.
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
    const [partner, assignments, asins, statuses, lineageRows] = await Promise.all([
      findPartnerById(id).catch((err: unknown) => {
        log.error('Failed to fetch partner', { err, partnerId: id })
        return undefined
      }),
      findPartnerAssignmentsDetail(id).catch((err: unknown) => {
        log.warn('Failed to fetch partner assignments', { err, partnerId: id })
        return []
      }),
      findPartnerAsins(id).catch((err: unknown) => {
        log.warn('Failed to fetch partner ASINs', { err, partnerId: id })
        return []
      }),
      findPartnerWeeklyStatuses(id, 156).catch((err: unknown) => {
        log.warn('Failed to fetch partner weekly statuses', { err, partnerId: id })
        return []
      }),
      findPartnerFieldLineage(id).catch((err: unknown) => {
        log.warn('Failed to fetch partner field lineage', { err, partnerId: id })
        return []
      }),
    ])

    if (partner === undefined) {
      return ApiErrors.database()
    }

    if (!partner) {
      return ApiErrors.notFound('Partner')
    }

    // Deduplicate lineage to get most recent per field
    const lineage = deduplicateLineage(lineageRows)

    return apiSuccess({
      partner: {
        ...partner,
        assignments,
        asins,
        recent_statuses: statuses,
        lineage,
      },
    })
  } catch (error) {
    log.error('Unexpected error in GET /api/partners/[id]', error)
    return ApiErrors.internal()
  }
}
