/**
 * Partner Repository
 *
 * Handles all database operations for the partners table.
 * No business logic — only typed Supabase queries.
 */

import { getAdminClient } from '@/lib/supabase/admin'
import { escapePostgrestValue } from '@/lib/api/search-utils'
import type {
  PartnerRecord,
  AssignmentRecord,
  BigQueryMappingRecord,
  CreatePartnerInput,
  StaffReference,
} from '@/types/partner.types'
import type { FieldLineageRow } from '@/types/lineage'
import type { PersistedPartnerTypeFields } from '@/lib/partners/computed-partner-type'

const supabase = getAdminClient()

export interface PartnerQueryParams {
  search?: string
  tierFilters?: string[]
  sort: string
  order: 'asc' | 'desc'
}

/**
 * Fetch partners with search, tier filter, and sorting
 */
export async function findPartners(
  params: PartnerQueryParams
): Promise<PartnerRecord[]> {
  // Full row needed: source_data required for computed status derivation
  let query = supabase
    .from('partners')
    .select('*')
    .is('deleted_at', null)

  if (params.search) {
    const escaped = escapePostgrestValue(params.search)
    query = query.or(
      `brand_name.ilike.%${escaped}%,client_name.ilike.%${escaped}%,partner_code.ilike.%${escaped}%`
    )
  }

  if (params.tierFilters && params.tierFilters.length > 0) {
    query = query.in('tier', params.tierFilters)
  }

  query = query
    .order(params.sort, { ascending: params.order === 'asc' })
    .limit(5000)

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch partners: ${error.message}`)
  }

  return (data || []) as PartnerRecord[]
}

/**
 * Fetch active staff assignments for given partner IDs
 */
export async function findAssignmentsByPartnerIds(
  partnerIds: string[]
): Promise<AssignmentRecord[]> {
  if (partnerIds.length === 0) return []

  const { data, error } = await supabase
    .from('partner_assignments')
    .select('partner_id, assignment_role, staff:staff_id(id, full_name)')
    .in('partner_id', partnerIds)
    .in('assignment_role', ['pod_leader', 'sales_rep'])
    .is('unassigned_at', null)
    .order('assigned_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch assignments: ${error.message}`)
  }

  return (data || []).map(a => ({
    partner_id: a.partner_id,
    assignment_role: a.assignment_role,
    staff: a.staff as unknown as StaffReference | null,
  }))
}

/**
 * Fetch BigQuery external ID mappings for given partner IDs
 */
export async function findBigQueryMappings(
  partnerIds: string[]
): Promise<BigQueryMappingRecord[]> {
  if (partnerIds.length === 0) return []

  const { data, error } = await supabase
    .from('entity_external_ids')
    .select('entity_id, external_id')
    .eq('entity_type', 'partners')
    .eq('source', 'bigquery')
    .in('entity_id', partnerIds)

  if (error) {
    throw new Error(`Failed to fetch BigQuery mappings: ${error.message}`)
  }

  return (data || []) as BigQueryMappingRecord[]
}

/**
 * Find a partner by brand name (case-insensitive)
 */
export async function findPartnerByBrandName(
  brandName: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('partners')
    .select('id')
    .ilike('brand_name', brandName)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to check existing partner: ${error.message}`)
  }

  return data
}

/**
 * Insert a new partner record
 */
export async function createPartner(
  input: CreatePartnerInput
): Promise<PartnerRecord> {
  const { data, error } = await supabase
    .from('partners')
    .insert({
      brand_name: input.brand_name,
      client_name: input.client_name,
      client_email: input.client_email,
      status: input.status,
      tier: input.tier,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create partner: ${error.message}`)
  }

  if (!data) {
    throw new Error('Partner creation returned no data')
  }

  return data as PartnerRecord
}

// =============================================================================
// Partner Detail
// =============================================================================

export interface PartnerAssignmentDetail {
  id: string
  assignment_role: string
  is_primary: boolean
  assigned_at: string | null
  staff: { id: string; full_name: string; email: string; role: string | null } | null
}

export interface PartnerAsin {
  id: string
  asin_code: string
  title: string | null
  status: string | null
  is_parent: boolean | null
}

export interface PartnerWeeklyStatus {
  id: string
  week_start_date: string
  status: string | null
  notes: string | null
}

/**
 * Fetch a single partner by ID, excluding soft-deleted rows.
 */
export async function findPartnerById(id: string): Promise<PartnerRecord | null> {
  const { data, error } = await supabase
    .from('partners')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch partner ${id}: ${error.message}`)
  }

  return data as PartnerRecord | null
}

/**
 * Fetch active staff assignments with staff detail for a partner.
 */
export async function findPartnerAssignmentsDetail(
  partnerId: string
): Promise<PartnerAssignmentDetail[]> {
  const { data, error } = await supabase
    .from('partner_assignments')
    .select('id, assignment_role, is_primary, assigned_at, staff:staff_id(id, full_name, email, role)')
    .eq('partner_id', partnerId)
    .is('unassigned_at', null)
    .order('assignment_role')

  if (error) {
    throw new Error(`Failed to fetch assignments for partner ${partnerId}: ${error.message}`)
  }

  return (data || []) as unknown as PartnerAssignmentDetail[]
}

/**
 * Fetch non-deleted ASINs for a partner.
 */
export async function findPartnerAsins(partnerId: string): Promise<PartnerAsin[]> {
  const { data, error } = await supabase
    .from('asins')
    .select('id, asin_code, title, status, is_parent')
    .eq('partner_id', partnerId)
    .is('deleted_at', null)
    .order('asin_code')

  if (error) {
    throw new Error(`Failed to fetch ASINs for partner ${partnerId}: ${error.message}`)
  }

  return (data || []) as PartnerAsin[]
}

/**
 * Fetch recent weekly statuses for a partner (newest first).
 */
export async function findPartnerWeeklyStatuses(
  partnerId: string,
  limit: number = 156
): Promise<PartnerWeeklyStatus[]> {
  const { data, error } = await supabase
    .from('weekly_statuses')
    .select('id, week_start_date, status, notes')
    .eq('partner_id', partnerId)
    .order('week_start_date', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to fetch weekly statuses for partner ${partnerId}: ${error.message}`)
  }

  return (data || []) as PartnerWeeklyStatus[]
}

/**
 * Fetch field lineage history for a partner (newest first).
 */
export async function findPartnerFieldLineage(partnerId: string): Promise<FieldLineageRow[]> {
  const { data, error } = await supabase
    .from('field_lineage')
    .select('field_name, source_type, source_ref, previous_value, new_value, changed_at, sync_run_id')
    .eq('entity_type', 'partners')
    .eq('entity_id', partnerId)
    .order('changed_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch field lineage for partner ${partnerId}: ${error.message}`)
  }

  return (data || []) as FieldLineageRow[]
}

// =============================================================================
// Partner Type Reconciliation
// =============================================================================

export interface PartnerReconciliationRecord {
  id: string
  brand_name: string
  partner_code: string | null
  client_name: string | null
  pod_leader_name: string | null
  brand_manager_name: string | null
  source_data: Record<string, Record<string, Record<string, unknown>>> | null
  computed_partner_type: string | null
  computed_partner_type_source: string | null
  staffing_partner_type: string | null
  legacy_partner_type_raw: string | null
  legacy_partner_type: string | null
  partner_type_matches: boolean | null
  partner_type_is_shared: boolean | null
  partner_type_reason: string | null
  partner_type_computed_at: string | null
}

/**
 * Fetch partners for type reconciliation processing.
 */
export async function findPartnersForReconciliation(
  limit: number,
  search?: string
): Promise<PartnerReconciliationRecord[]> {
  let query = supabase
    .from('partners')
    .select(`
      id,
      brand_name,
      partner_code,
      client_name,
      pod_leader_name,
      brand_manager_name,
      source_data,
      computed_partner_type,
      computed_partner_type_source,
      staffing_partner_type,
      legacy_partner_type_raw,
      legacy_partner_type,
      partner_type_matches,
      partner_type_is_shared,
      partner_type_reason,
      partner_type_computed_at
    `)
    .order('brand_name', { ascending: true })
    .limit(limit)

  if (search) {
    const escaped = escapePostgrestValue(search)
    if (escaped) {
      query = query.or(
        `brand_name.ilike.${escaped},client_name.ilike.${escaped},partner_code.ilike.${escaped}`
      )
    }
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch partners for reconciliation: ${error.message}`)
  }

  return (data || []) as PartnerReconciliationRecord[]
}

/**
 * Update partner type fields after reconciliation.
 */
export async function updatePartnerTypeFields(
  id: string,
  fields: PersistedPartnerTypeFields,
  computedAt: string
): Promise<void> {
  const { error } = await supabase
    .from('partners')
    .update({
      ...fields,
      partner_type_computed_at: computedAt,
    })
    .eq('id', id)
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed to update partner type fields for ${id}: ${error.message}`)
  }
}
