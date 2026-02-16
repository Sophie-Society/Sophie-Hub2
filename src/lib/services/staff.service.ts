/**
 * Staff Service
 *
 * Business logic for staff operations.
 */

import * as staffRepo from '@/lib/repositories/staff.repository'

// =============================================================================
// Staff List
// =============================================================================

export interface StaffListParams {
  search?: string
  status?: string
  role?: string
  department?: string
  sort: string
  order: 'asc' | 'desc'
  limit: number
  offset: number
}

export interface StaffListResult {
  staff: unknown[]
  total: number
  has_more: boolean
}

export async function listStaff(params: StaffListParams): Promise<StaffListResult> {
  const result = await staffRepo.findStaffList({
    search: params.search,
    statuses: params.status ? params.status.split(',').map(s => s.trim()).filter(Boolean) : undefined,
    roles: params.role ? params.role.split(',').map(r => r.trim()).filter(Boolean) : undefined,
    departments: params.department ? params.department.split(',').map(d => d.trim()).filter(Boolean) : undefined,
    sort: params.sort,
    order: params.order,
    limit: params.limit,
    offset: params.offset,
  })

  return {
    staff: result.staff,
    total: result.total,
    has_more: result.total > params.offset + params.limit,
  }
}

// =============================================================================
// Staff Detail
// =============================================================================

export async function getStaffDetail(id: string): Promise<unknown | null> {
  return staffRepo.findStaffById(id)
}

export async function getStaffAssignments(staffId: string): Promise<unknown[]> {
  return staffRepo.findAssignmentsByStaffId(staffId)
}
