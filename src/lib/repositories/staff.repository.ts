/**
 * Staff Repository
 *
 * All Supabase queries for staff operations.
 */

import { getAdminClient } from '@/lib/supabase/admin'
import { escapePostgrestValue } from '@/lib/api/search-utils'

// =============================================================================
// Staff List
// =============================================================================

export interface StaffListQueryParams {
  search?: string
  statuses?: string[]
  roles?: string[]
  departments?: string[]
  sort: string
  order: 'asc' | 'desc'
  limit: number
  offset: number
}

export interface StaffListResult {
  staff: unknown[]
  total: number
}

export async function findStaffList(params: StaffListQueryParams): Promise<StaffListResult> {
  const supabase = getAdminClient()
  let query = supabase
    .from('staff')
    .select(
      'id, staff_code, full_name, email, role, department, title, status, max_clients, current_client_count, services, hire_date, avatar_url, timezone, created_at',
      { count: 'exact' }
    )

  if (params.search) {
    const escaped = escapePostgrestValue(params.search)
    query = query.or(
      `full_name.ilike.%${escaped}%,email.ilike.%${escaped}%,staff_code.ilike.%${escaped}%`
    )
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

  query = query
    .order(params.sort, { ascending: params.order === 'asc' })
    .range(params.offset, params.offset + params.limit - 1)

  const { data, error, count } = await query

  if (error) throw new Error(`Failed to fetch staff: ${error.message}`)
  return {
    staff: data || [],
    total: count || 0,
  }
}

// =============================================================================
// Staff Detail
// =============================================================================

export async function findStaffById(id: string): Promise<unknown | null> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch staff member: ${error.message}`)
  return data
}

// =============================================================================
// Staff Assignments
// =============================================================================

export async function findAssignmentsByStaffId(staffId: string): Promise<unknown[]> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('partner_assignments')
    .select('id, assignment_role, assigned_at, unassigned_at, partner:partner_id(id, brand_name, status, tier)')
    .eq('staff_id', staffId)
    .order('assigned_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch staff assignments: ${error.message}`)
  return data || []
}
