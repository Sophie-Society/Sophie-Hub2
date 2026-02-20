/**
 * Staff Repository
 *
 * Handles all database operations for the staff table.
 * No business logic — only typed Supabase queries.
 */

import { getAdminClient } from '@/lib/supabase/admin'
import { escapePostgrestValue } from '@/lib/api/search-utils'
import type { FieldLineageRow } from '@/types/lineage'

const supabase = getAdminClient()

// =============================================================================
// Types
// =============================================================================

export interface StaffRecord {
  id: string
  staff_code: string | null
  full_name: string
  email: string | null
  role: string | null
  department: string | null
  title: string | null
  status: string | null
  status_tags: unknown[] | null
  max_clients: number | null
  current_client_count: number | null
  services: unknown | null
  hire_date: string | null
  avatar_url: string | null
  timezone: string | null
  created_at: string
  source_data: unknown | null
}

export interface StaffDetailRecord extends StaffRecord {
  [key: string]: unknown
}

export interface StaffAssignment {
  id: string
  assignment_role: string
  is_primary: boolean
  partner: { id: string; brand_name: string; status: string | null } | null
}

export interface StaffQueryParams {
  search?: string
  statuses?: string[]
  roles?: string[]
  departments?: string[]
  sort: 'full_name' | 'created_at' | 'role' | 'hire_date' | 'google_last_login_at'
  ascending: boolean
  needsComputedProcessing: boolean
  limit: number
  offset: number
}

export interface StaffUpdateInput {
  role?: string
  status?: string
  status_tags?: string[]
}

// =============================================================================
// Queries
// =============================================================================

/**
 * Fetch staff list with search, filter, and pagination.
 * When needsComputedProcessing is true, fetches up to 5000 rows for
 * in-memory computed sorting/filtering (e.g. by google_last_login_at).
 */
export async function findStaff(
  params: StaffQueryParams
): Promise<{ data: StaffRecord[]; count: number | null }> {
  let query = supabase
    .from('staff')
    .select(
      'id, staff_code, full_name, email, role, department, title, status, status_tags, max_clients, current_client_count, services, hire_date, avatar_url, timezone, created_at, source_data',
      { count: 'exact' }
    )

  if (params.search) {
    const escaped = escapePostgrestValue(params.search)
    if (escaped) {
      query = query.or(
        `full_name.ilike.${escaped},email.ilike.${escaped},staff_code.ilike.${escaped}`
      )
    }
  }

  if (params.statuses && params.statuses.length > 0) {
    query = query.in('status', params.statuses)
  }

  if (params.roles && params.roles.length > 0) {
    query = query.in('role', params.roles)
  }

  if (params.departments && params.departments.length > 0) {
    query = query.in('department', params.departments)
  }

  if (params.needsComputedProcessing) {
    query = query.range(0, 4999)
  } else {
    query = query
      .order(params.sort, { ascending: params.ascending })
      .range(params.offset, params.offset + params.limit - 1)
  }

  const { data, error, count } = await query

  if (error) {
    throw new Error(`Failed to fetch staff: ${error.message}`)
  }

  return { data: (data || []) as StaffRecord[], count }
}

/**
 * Fetch a single staff member by ID.
 */
export async function findStaffById(id: string): Promise<StaffDetailRecord | null> {
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to fetch staff member ${id}: ${error.message}`)
  }

  return data as StaffDetailRecord | null
}

/**
 * Fetch active partner assignments for a staff member.
 */
export async function findStaffAssignments(staffId: string): Promise<StaffAssignment[]> {
  const { data, error } = await supabase
    .from('partner_assignments')
    .select('id, assignment_role, is_primary, partner:partner_id(id, brand_name, status)')
    .eq('staff_id', staffId)
    .is('unassigned_at', null)
    .order('assignment_role')

  if (error) {
    throw new Error(`Failed to fetch assignments for staff ${staffId}: ${error.message}`)
  }

  return (data || []) as unknown as StaffAssignment[]
}

/**
 * Fetch field lineage history for a staff member (newest first).
 */
export async function findStaffFieldLineage(staffId: string): Promise<FieldLineageRow[]> {
  const { data, error } = await supabase
    .from('field_lineage')
    .select('field_name, source_type, source_ref, previous_value, new_value, changed_at, sync_run_id')
    .eq('entity_type', 'staff')
    .eq('entity_id', staffId)
    .order('changed_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch field lineage for staff ${staffId}: ${error.message}`)
  }

  return (data || []) as FieldLineageRow[]
}

/**
 * Update editable fields on a staff record.
 * Returns the updated row, or null if not found.
 */
export async function updateStaff(
  id: string,
  updates: Record<string, unknown>
): Promise<StaffDetailRecord | null> {
  const { data, error } = await supabase
    .from('staff')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to update staff member ${id}: ${error.message}`)
  }

  return data as StaffDetailRecord | null
}
