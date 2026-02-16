/**
 * Partner Service
 *
 * Business logic for partner operations.
 */

import * as partnerRepo from '@/lib/repositories/partner.repository'
import { computePartnerStatus, matchesStatusFilter } from '@/lib/partners/computed-status'

// =============================================================================
// Partner List
// =============================================================================

export interface PartnerListParams {
  search?: string
  statusFilters?: string[]
  tier?: string[]
  sort: string
  order: 'asc' | 'desc'
  limit: number
  offset: number
}

export interface PartnerListResult {
  partners: unknown[]
  total: number
  has_more: boolean
}

export async function listPartners(params: PartnerListParams): Promise<PartnerListResult> {
  const allPartners = await partnerRepo.findAllPartners({
    search: params.search,
    tier: params.tier,
    sort: params.sort,
    order: params.order,
  })

  // Compute status for each partner
  type SourceDataType = Record<string, Record<string, Record<string, unknown>>> | null
  const allPartnersTyped = allPartners as Array<Record<string, unknown>>

  let filteredPartners = allPartnersTyped.map(p => {
    const sourceData = p.source_data as SourceDataType
    const computed = computePartnerStatus(sourceData, p.status as string | null)
    const enriched: Record<string, unknown> = {
      ...p,
      computed_status: computed.computedStatus,
      computed_status_label: computed.displayLabel,
      computed_status_bucket: computed.bucket,
      latest_weekly_status: computed.latestWeeklyStatus,
      status_matches: computed.matchesSheetStatus,
      weeks_without_data: computed.weeksWithoutData,
    }
    return enriched
  })

  // Apply status filter based on computed status
  if (params.statusFilters && params.statusFilters.length > 0) {
    filteredPartners = filteredPartners.filter(p =>
      matchesStatusFilter(
        p.source_data as SourceDataType,
        p.status as string | null,
        params.statusFilters!
      )
    )
  }

  const total = filteredPartners.length
  const paginatedPartners = filteredPartners.slice(params.offset, params.offset + params.limit)

  // Batch fetch staff assignments
  const partnerIds = paginatedPartners.map(p => p.id as string)
  const [assignments, bqMappings] = await Promise.all([
    partnerRepo.findAssignmentsForPartners(partnerIds),
    partnerRepo.findBigQueryMappings(partnerIds),
  ])

  const podLeaders: Record<string, partnerRepo.StaffAssignment> = {}
  const salesReps: Record<string, partnerRepo.StaffAssignment> = {}
  for (const a of assignments) {
    if (a.staff) {
      if (a.assignment_role === 'pod_leader') {
        podLeaders[a.partner_id] = a.staff
      } else if (a.assignment_role === 'sales_rep') {
        salesReps[a.partner_id] = a.staff
      }
    }
  }

  const bigqueryMap: Record<string, string> = {}
  for (const m of bqMappings) {
    bigqueryMap[m.entity_id] = m.external_id
  }

  const partnersWithRelations = paginatedPartners.map(p => ({
    ...p,
    pod_leader: podLeaders[p.id as string] || null,
    sales_rep: salesReps[p.id as string] || null,
    has_bigquery: !!bigqueryMap[p.id as string],
    bigquery_client_name: bigqueryMap[p.id as string] || null,
  }))

  return {
    partners: partnersWithRelations,
    total,
    has_more: total > params.offset + params.limit,
  }
}

// =============================================================================
// Partner Create
// =============================================================================

export async function createPartner(input: {
  brand_name: string
  client_name?: string
  client_email?: string
  status: string
  tier?: string
}): Promise<{ partner: unknown; duplicate: boolean }> {
  const existing = await partnerRepo.findPartnerByBrandName(input.brand_name)
  if (existing) {
    return { partner: null, duplicate: true }
  }

  const partner = await partnerRepo.createPartner({
    brand_name: input.brand_name,
    client_name: input.client_name || null,
    client_email: input.client_email || null,
    status: input.status,
    tier: input.tier || null,
  })

  return { partner, duplicate: false }
}

// =============================================================================
// Partner Detail
// =============================================================================

export async function getPartnerDetail(id: string): Promise<unknown | null> {
  return partnerRepo.findPartnerById(id)
}

export async function getPartnerAssignments(partnerId: string): Promise<unknown[]> {
  return partnerRepo.findAssignmentsByPartnerId(partnerId)
}

export async function getPartnerAsins(partnerId: string): Promise<unknown[]> {
  return partnerRepo.findAsinsByPartnerId(partnerId)
}

export async function getPartnerWeeklyStatuses(partnerId: string): Promise<unknown[]> {
  return partnerRepo.findWeeklyStatusesByPartnerId(partnerId)
}
