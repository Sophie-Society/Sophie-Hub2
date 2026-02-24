/**
 * Tests for staff.repository
 * Covers: findStaff, findStaffById, findStaffAssignments,
 *         findStaffFieldLineage, updateStaff
 */

jest.mock('@/lib/supabase/admin', () => {
  const client = { from: jest.fn() }
  return { getAdminClient: jest.fn(() => client), _client: client }
})

jest.mock('@/lib/api/search-utils', () => ({
  escapePostgrestValue: jest.fn((s: string) => s),
}))

import {
  findStaff,
  findStaffById,
  findStaffAssignments,
  findStaffFieldLineage,
  updateStaff,
  type StaffQueryParams,
} from '@/lib/repositories/staff.repository'

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

type MockResult = {
  data: unknown
  error: { message: string; code?: string } | null
  count?: number | null
}

function makeMockChain(result: MockResult) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'is', 'in', 'or', 'ilike', 'not',
    'order', 'limit', 'range',
  ]
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain)
  }
  chain.single = jest.fn().mockResolvedValue(result)
  chain.maybeSingle = jest.fn().mockResolvedValue(result)
  chain.then = (
    resolve: (v: MockResult) => unknown,
    reject?: (e: unknown) => unknown
  ) => Promise.resolve(result).then(resolve, reject)
  return chain
}

const { _client: mockClient } = jest.requireMock('@/lib/supabase/admin') as {
  _client: { from: jest.Mock }
}

const mockStaff = {
  id: 'staff-uuid-1',
  staff_code: 'ST001',
  full_name: 'Jane Smith',
  email: 'jane@example.com',
  role: 'pod_leader',
  department: 'operations',
  title: 'Pod Leader',
  status: 'active',
  status_tags: null,
  max_clients: 20,
  current_client_count: 15,
  services: null,
  hire_date: '2022-01-01',
  avatar_url: null,
  timezone: 'America/New_York',
  created_at: '2022-01-01T00:00:00Z',
  source_data: null,
}

const defaultParams: StaffQueryParams = {
  sort: 'full_name',
  ascending: true,
  needsComputedProcessing: false,
  limit: 20,
  offset: 0,
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// findStaff
// ---------------------------------------------------------------------------

describe('findStaff', () => {
  it('returns staff records and count on success', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: [mockStaff], error: null, count: 1 })
    )

    const result = await findStaff(defaultParams)

    expect(result.data).toHaveLength(1)
    expect(result.data[0].full_name).toBe('Jane Smith')
    expect(result.count).toBe(1)
    expect(mockClient.from).toHaveBeenCalledWith('staff')
  })

  it('returns empty data and null count when no staff exists', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: [], error: null, count: 0 })
    )

    const result = await findStaff(defaultParams)
    expect(result.data).toEqual([])
    expect(result.count).toBe(0)
  })

  it('handles null data by returning empty array', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: null, count: null })
    )

    const result = await findStaff(defaultParams)
    expect(result.data).toEqual([])
    expect(result.count).toBeNull()
  })

  it('applies search filter when search is provided', async () => {
    const chain = makeMockChain({ data: [mockStaff], error: null, count: 1 })
    mockClient.from.mockReturnValue(chain)

    await findStaff({ ...defaultParams, search: 'Jane' })

    expect((chain.or as jest.Mock)).toHaveBeenCalledWith(
      expect.stringContaining('full_name.ilike.')
    )
  })

  it('applies status filter with .in() when statuses are provided', async () => {
    const chain = makeMockChain({ data: [mockStaff], error: null, count: 1 })
    mockClient.from.mockReturnValue(chain)

    await findStaff({ ...defaultParams, statuses: ['active', 'on_leave'] })

    expect((chain.in as jest.Mock)).toHaveBeenCalledWith('status', ['active', 'on_leave'])
  })

  it('applies role filter with .in() when roles are provided', async () => {
    const chain = makeMockChain({ data: [mockStaff], error: null, count: 1 })
    mockClient.from.mockReturnValue(chain)

    await findStaff({ ...defaultParams, roles: ['pod_leader'] })

    expect((chain.in as jest.Mock)).toHaveBeenCalledWith('role', ['pod_leader'])
  })

  it('applies department filter with .in() when departments are provided', async () => {
    const chain = makeMockChain({ data: [mockStaff], error: null, count: 1 })
    mockClient.from.mockReturnValue(chain)

    await findStaff({ ...defaultParams, departments: ['operations'] })

    expect((chain.in as jest.Mock)).toHaveBeenCalledWith('department', ['operations'])
  })

  it('uses range(0, 4999) when needsComputedProcessing is true', async () => {
    const chain = makeMockChain({ data: [mockStaff], error: null, count: 1 })
    mockClient.from.mockReturnValue(chain)

    await findStaff({ ...defaultParams, needsComputedProcessing: true })

    expect((chain.range as jest.Mock)).toHaveBeenCalledWith(0, 4999)
  })

  it('uses order+range for normal pagination when needsComputedProcessing is false', async () => {
    const chain = makeMockChain({ data: [mockStaff], error: null, count: 1 })
    mockClient.from.mockReturnValue(chain)

    await findStaff({ ...defaultParams, offset: 20, limit: 10 })

    expect((chain.order as jest.Mock)).toHaveBeenCalledWith('full_name', { ascending: true })
    expect((chain.range as jest.Mock)).toHaveBeenCalledWith(20, 29)
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'staff query failed' }, count: null })
    )

    await expect(findStaff(defaultParams)).rejects.toThrow(
      'Failed to fetch staff: staff query failed'
    )
  })
})

// ---------------------------------------------------------------------------
// findStaffById
// ---------------------------------------------------------------------------

describe('findStaffById', () => {
  it('returns the staff record when found', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: mockStaff, error: null })
    )

    const result = await findStaffById('staff-uuid-1')

    expect(result).toEqual(mockStaff)
    expect(mockClient.from).toHaveBeenCalledWith('staff')
  })

  it('returns null when staff is not found (PGRST116)', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({
        data: null,
        error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
      })
    )

    const result = await findStaffById('nonexistent')
    expect(result).toBeNull()
  })

  it('throws on unexpected database errors', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'connection error', code: '08000' } })
    )

    await expect(findStaffById('staff-uuid-1')).rejects.toThrow(
      'Failed to fetch staff member staff-uuid-1: connection error'
    )
  })
})

// ---------------------------------------------------------------------------
// findStaffAssignments
// ---------------------------------------------------------------------------

describe('findStaffAssignments', () => {
  it('returns active partner assignments for a staff member', async () => {
    const mockAssignments = [
      {
        id: 'assign-1',
        assignment_role: 'pod_leader',
        is_primary: true,
        partner: { id: 'partner-1', brand_name: 'Acme Corp', status: 'active' },
      },
    ]
    mockClient.from.mockReturnValue(makeMockChain({ data: mockAssignments, error: null }))

    const result = await findStaffAssignments('staff-uuid-1')

    expect(result).toHaveLength(1)
    expect(result[0].assignment_role).toBe('pod_leader')
    expect(mockClient.from).toHaveBeenCalledWith('partner_assignments')
  })

  it('returns empty array when staff has no assignments', async () => {
    mockClient.from.mockReturnValue(makeMockChain({ data: [], error: null }))

    const result = await findStaffAssignments('staff-uuid-1')
    expect(result).toEqual([])
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'assignments error' } })
    )

    await expect(
      findStaffAssignments('staff-uuid-1')
    ).rejects.toThrow('Failed to fetch assignments for staff staff-uuid-1: assignments error')
  })
})

// ---------------------------------------------------------------------------
// findStaffFieldLineage
// ---------------------------------------------------------------------------

describe('findStaffFieldLineage', () => {
  it('returns field lineage records for a staff member', async () => {
    const mockLineage = [
      {
        field_name: 'full_name',
        source_type: 'gsheets',
        source_ref: 'Staff Sheet',
        previous_value: null,
        new_value: 'Jane Smith',
        changed_at: '2024-01-01T00:00:00Z',
        sync_run_id: 'sync-1',
      },
    ]
    mockClient.from.mockReturnValue(makeMockChain({ data: mockLineage, error: null }))

    const result = await findStaffFieldLineage('staff-uuid-1')

    expect(result).toHaveLength(1)
    expect(result[0].field_name).toBe('full_name')
    expect(mockClient.from).toHaveBeenCalledWith('field_lineage')
  })

  it('returns empty array when no lineage exists', async () => {
    mockClient.from.mockReturnValue(makeMockChain({ data: [], error: null }))

    const result = await findStaffFieldLineage('staff-uuid-1')
    expect(result).toEqual([])
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'lineage error' } })
    )

    await expect(
      findStaffFieldLineage('staff-uuid-1')
    ).rejects.toThrow('Failed to fetch field lineage for staff staff-uuid-1: lineage error')
  })
})

// ---------------------------------------------------------------------------
// updateStaff
// ---------------------------------------------------------------------------

describe('updateStaff', () => {
  it('returns the updated staff record on success', async () => {
    const updatedStaff = { ...mockStaff, role: 'operations_admin' }
    mockClient.from.mockReturnValue(
      makeMockChain({ data: updatedStaff, error: null })
    )

    const result = await updateStaff('staff-uuid-1', { role: 'operations_admin' })

    expect(result).toEqual(updatedStaff)
    expect(result!.role).toBe('operations_admin')
    expect(mockClient.from).toHaveBeenCalledWith('staff')
  })

  it('returns null when staff is not found (PGRST116)', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({
        data: null,
        error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
      })
    )

    const result = await updateStaff('nonexistent', { role: 'staff' })
    expect(result).toBeNull()
  })

  it('throws on unexpected database errors', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'constraint violation', code: '23000' } })
    )

    await expect(
      updateStaff('staff-uuid-1', { role: 'invalid_role' })
    ).rejects.toThrow('Failed to update staff member staff-uuid-1: constraint violation')
  })

  it('can update multiple fields at once', async () => {
    const updates = { role: 'admin', status: 'on_leave', title: 'Senior Manager' }
    const updatedStaff = { ...mockStaff, ...updates }
    mockClient.from.mockReturnValue(
      makeMockChain({ data: updatedStaff, error: null })
    )

    const result = await updateStaff('staff-uuid-1', updates)

    expect(result!.role).toBe('admin')
    expect(result!.status).toBe('on_leave')
  })
})
