/**
 * Partner Repository
 *
 * All Supabase queries for partner operations.
 */

import { getAdminClient } from '@/lib/supabase/admin'
import { escapePostgrestValue } from '@/lib/api/search-utils'

// =============================================================================
// Partner List
// =============================================================================

export interface PartnerListQueryParams {
  search?: string
  tier?: string[]
  sort: string
  order: 'asc' | 'desc'
}

export async function findAllPartners(params: PartnerListQueryParams): Promise<unknown[]> {
  const supabase = getAdminClient()
  let query = supabase.from('partners').select('*')

  if (params.search) {
    const escaped = escapePostgrestValue(params.search)
    query = query.or(
      `brand_name.ilike.%${escaped}%,client_name.ilike.%${escaped}%,partner_code.ilike.%${escaped}%`
    )
  }

  if (params.tier && params.tier.length > 0) {
    query = query.in('tier', params.tier)
  }

  query = query.order(params.sort, { ascending: params.order === 'asc' })
  query = query.limit(5000)

  const { data, error } = await query

  if (error) throw new Error(`Failed to fetch partners: ${error.message}`)
  return data || []
}

// =============================================================================
// Partner Detail
// =============================================================================

export async function findPartnerById(id: string): Promise<unknown | null> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('partners')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch partner: ${error.message}`)
  return data
}

// =============================================================================
// Partner Assignments (batch)
// =============================================================================

export interface StaffAssignment {
  id: string
  full_name: string
}

export async function findAssignmentsForPartners(
  partnerIds: string[]
): Promise<Array<{ partner_id: string; assignment_role: string; staff: StaffAssignment | null }>> {
  if (partnerIds.length === 0) return []

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('partner_assignments')
    .select('partner_id, assignment_role, staff:staff_id(id, full_name)')
    .in('partner_id', partnerIds)
    .in('assignment_role', ['pod_leader', 'sales_rep'])
    .is('unassigned_at', null)

  if (error) throw new Error(`Failed to fetch assignments: ${error.message}`)

  return (data || []).map(a => ({
    partner_id: a.partner_id as string,
    assignment_role: a.assignment_role as string,
    staff: a.staff as unknown as StaffAssignment | null,
  }))
}

// =============================================================================
// BigQuery External ID Mappings
// =============================================================================

export async function findBigQueryMappings(
  partnerIds: string[]
): Promise<Array<{ entity_id: string; external_id: string }>> {
  if (partnerIds.length === 0) return []

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('entity_external_ids')
    .select('entity_id, external_id')
    .eq('entity_type', 'partners')
    .eq('source', 'bigquery')
    .in('entity_id', partnerIds)

  if (error) throw new Error(`Failed to fetch BigQuery mappings: ${error.message}`)
  return (data || []) as Array<{ entity_id: string; external_id: string }>
}

// =============================================================================
// Partner Create
// =============================================================================

export async function findPartnerByBrandName(brandName: string): Promise<{ id: string } | null> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('partners')
    .select('id')
    .ilike('brand_name', brandName)
    .maybeSingle()

  if (error) throw new Error(`Failed to check partner existence: ${error.message}`)
  return data as { id: string } | null
}

export async function createPartner(input: {
  brand_name: string
  client_name: string | null
  client_email: string | null
  status: string
  tier: string | null
}): Promise<unknown> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('partners')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(`Failed to create partner: ${error.message}`)
  return data
}

// =============================================================================
// Partner Update
// =============================================================================

export async function updatePartner(id: string, updates: Record<string, unknown>): Promise<unknown> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('partners')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Failed to update partner: ${error.message}`)
  return data
}

// =============================================================================
// Partner Assignments (detail)
// =============================================================================

export async function findAssignmentsByPartnerId(
  partnerId: string
): Promise<unknown[]> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('partner_assignments')
    .select('id, assignment_role, assigned_at, unassigned_at, staff:staff_id(id, full_name, email, role, avatar_url)')
    .eq('partner_id', partnerId)
    .order('assigned_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch partner assignments: ${error.message}`)
  return data || []
}

// =============================================================================
// Partner ASINs
// =============================================================================

export async function findAsinsByPartnerId(partnerId: string): Promise<unknown[]> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('asins')
    .select('id, asin, title, status, marketplace, created_at')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch ASINs: ${error.message}`)
  return data || []
}

// =============================================================================
// Partner Weekly Statuses
// =============================================================================

export async function findWeeklyStatusesByPartnerId(partnerId: string): Promise<unknown[]> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('weekly_statuses')
    .select('*')
    .eq('partner_id', partnerId)
    .order('week_start', { ascending: false })

  if (error) throw new Error(`Failed to fetch weekly statuses: ${error.message}`)
  return data || []
}

// =============================================================================
// Field Lineage
// =============================================================================

export async function findFieldLineageMappings(): Promise<unknown[]> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('column_mappings')
    .select(`
      id,
      source_column,
      target_field,
      category,
      tab_mapping:tab_mapping_id (
        id,
        tab_name,
        data_source:data_source_id (
          id,
          name
        )
      )
    `)
    .eq('category', 'partner')
    .not('target_field', 'is', null)

  if (error) throw new Error(`Failed to fetch field lineage: ${error.message}`)
  return data || []
}

// =============================================================================
// Partner Source URL
// =============================================================================

export async function findPartnerSourceUrl(partnerId: string): Promise<unknown | null> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('tab_mappings')
    .select(`
      id,
      tab_name,
      data_source:data_source_id (
        id,
        name,
        spreadsheet_id
      )
    `)
    .eq('primary_entity', 'partners')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch source URL: ${error.message}`)
  return data
}
