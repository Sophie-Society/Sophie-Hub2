/**
 * Tests for partner.repository
 * Covers: findPartners, findAssignmentsByPartnerIds, findBigQueryMappings,
 *         findPartnerByBrandName, createPartner, findPartnerById,
 *         findPartnerAssignmentsDetail, findPartnerAsins,
 *         findPartnerWeeklyStatuses, findPartnerFieldLineage,
 *         findPartnersForReconciliation, updatePartnerTypeFields
 */

jest.mock('@/lib/supabase/admin', () => {
  const client = { from: jest.fn() }
  return { getAdminClient: jest.fn(() => client), _client: client }
})

// escapePostgrestValue is a lightweight string helper — use the real implementation
jest.mock('@/lib/api/search-utils', () => ({
  escapePostgrestValue: jest.fn((s: string) => s),
}))

import {
  findPartners,
  findAssignmentsByPartnerIds,
  findBigQueryMappings,
  findPartnerByBrandName,
  createPartner,
  findPartnerById,
  findPartnerAssignmentsDetail,
  findPartnerAsins,
  findPartnerWeeklyStatuses,
  findPartnerFieldLineage,
  findPartnersForReconciliation,
  updatePartnerTypeFields,
} from '@/lib/repositories/partner.repository'

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

const mockPartner = {
  id: 'partner-uuid-1',
  brand_name: 'Acme Corp',
  client_name: 'Acme Client',
  client_email: 'acme@example.com',
  status: 'active',
  tier: 'tier_1',
  partner_code: 'ACME',
  source_data: null,
  deleted_at: null,
  created_at: '2024-01-01T00:00:00Z',
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// findPartners
// ---------------------------------------------------------------------------

describe('findPartners', () => {
  it('returns partners with default params', async () => {
    const partners = [mockPartner]
    mockClient.from.mockReturnValue(makeMockChain({ data: partners, error: null }))

    const result = await findPartners({ sort: 'brand_name', order: 'asc' })

    expect(result).toHaveLength(1)
    expect(result[0].brand_name).toBe('Acme Corp')
    expect(mockClient.from).toHaveBeenCalledWith('partners')
  })

  it('returns empty array when no partners exist', async () => {
    mockClient.from.mockReturnValue(makeMockChain({ data: [], error: null }))

    const result = await findPartners({ sort: 'brand_name', order: 'asc' })
    expect(result).toEqual([])
  })

  it('returns empty array when data is null', async () => {
    mockClient.from.mockReturnValue(makeMockChain({ data: null, error: null }))

    const result = await findPartners({ sort: 'brand_name', order: 'asc' })
    expect(result).toEqual([])
  })

  it('applies search filter with .or() when search is provided', async () => {
    const chain = makeMockChain({ data: [mockPartner], error: null })
    mockClient.from.mockReturnValue(chain)

    await findPartners({ search: 'Acme', sort: 'brand_name', order: 'asc' })

    expect((chain.or as jest.Mock)).toHaveBeenCalledWith(
      expect.stringContaining('brand_name.ilike.')
    )
  })

  it('applies tier filter with .in() when tierFilters is provided', async () => {
    const chain = makeMockChain({ data: [mockPartner], error: null })
    mockClient.from.mockReturnValue(chain)

    await findPartners({ tierFilters: ['tier_1', 'tier_2'], sort: 'brand_name', order: 'asc' })

    expect((chain.in as jest.Mock)).toHaveBeenCalledWith('tier', ['tier_1', 'tier_2'])
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'query failed' } })
    )

    await expect(
      findPartners({ sort: 'brand_name', order: 'asc' })
    ).rejects.toThrow('Failed to fetch partners: query failed')
  })
})

// ---------------------------------------------------------------------------
// findAssignmentsByPartnerIds
// ---------------------------------------------------------------------------

describe('findAssignmentsByPartnerIds', () => {
  it('returns empty array immediately when partnerIds is empty', async () => {
    const result = await findAssignmentsByPartnerIds([])
    expect(result).toEqual([])
    expect(mockClient.from).not.toHaveBeenCalled()
  })

  it('returns assignment records', async () => {
    const mockAssignments = [
      {
        partner_id: 'partner-uuid-1',
        assignment_role: 'pod_leader',
        staff: { id: 'staff-1', full_name: 'Jane Smith' },
      },
    ]
    mockClient.from.mockReturnValue(makeMockChain({ data: mockAssignments, error: null }))

    const result = await findAssignmentsByPartnerIds(['partner-uuid-1'])

    expect(result).toHaveLength(1)
    expect(result[0].assignment_role).toBe('pod_leader')
    expect(mockClient.from).toHaveBeenCalledWith('partner_assignments')
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'assignment error' } })
    )

    await expect(
      findAssignmentsByPartnerIds(['partner-uuid-1'])
    ).rejects.toThrow('Failed to fetch assignments: assignment error')
  })
})

// ---------------------------------------------------------------------------
// findBigQueryMappings
// ---------------------------------------------------------------------------

describe('findBigQueryMappings', () => {
  it('returns empty array immediately when partnerIds is empty', async () => {
    const result = await findBigQueryMappings([])
    expect(result).toEqual([])
    expect(mockClient.from).not.toHaveBeenCalled()
  })

  it('returns BigQuery mapping records', async () => {
    const mockMappings = [
      { entity_id: 'partner-uuid-1', external_id: 'bq-client-name' },
    ]
    mockClient.from.mockReturnValue(makeMockChain({ data: mockMappings, error: null }))

    const result = await findBigQueryMappings(['partner-uuid-1'])

    expect(result).toHaveLength(1)
    expect(result[0].external_id).toBe('bq-client-name')
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'bq error' } })
    )

    await expect(
      findBigQueryMappings(['partner-uuid-1'])
    ).rejects.toThrow('Failed to fetch BigQuery mappings: bq error')
  })
})

// ---------------------------------------------------------------------------
// findPartnerByBrandName
// ---------------------------------------------------------------------------

describe('findPartnerByBrandName', () => {
  it('returns the partner id when a matching partner is found', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: { id: 'partner-uuid-1' }, error: null })
    )

    const result = await findPartnerByBrandName('Acme Corp')
    expect(result).toEqual({ id: 'partner-uuid-1' })
  })

  it('returns null when no matching partner exists', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: null })
    )

    const result = await findPartnerByBrandName('Unknown Brand')
    expect(result).toBeNull()
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'ilike error' } })
    )

    await expect(findPartnerByBrandName('Some Brand')).rejects.toThrow(
      'Failed to check existing partner: ilike error'
    )
  })
})

// ---------------------------------------------------------------------------
// createPartner
// ---------------------------------------------------------------------------

describe('createPartner', () => {
  const createInput = {
    brand_name: 'New Brand',
    client_name: 'New Client',
    client_email: 'new@example.com',
    status: 'active' as const,
    tier: 'tier_2',
  }

  it('returns the newly created partner record', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: { ...mockPartner, brand_name: 'New Brand' }, error: null })
    )

    const result = await createPartner(createInput)

    expect(result.brand_name).toBe('New Brand')
    expect(mockClient.from).toHaveBeenCalledWith('partners')
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'not null violation' } })
    )

    await expect(createPartner(createInput)).rejects.toThrow(
      'Failed to create partner: not null violation'
    )
  })

  it('throws when data is null (no row returned)', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: null })
    )

    await expect(createPartner(createInput)).rejects.toThrow(
      'Partner creation returned no data'
    )
  })
})

// ---------------------------------------------------------------------------
// findPartnerById
// ---------------------------------------------------------------------------

describe('findPartnerById', () => {
  it('returns the partner when found', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: mockPartner, error: null })
    )

    const result = await findPartnerById('partner-uuid-1')
    expect(result).toEqual(mockPartner)
    expect(mockClient.from).toHaveBeenCalledWith('partners')
  })

  it('returns null when partner is not found', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: null })
    )

    const result = await findPartnerById('nonexistent')
    expect(result).toBeNull()
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'db error' } })
    )

    await expect(findPartnerById('partner-uuid-1')).rejects.toThrow(
      'Failed to fetch partner partner-uuid-1: db error'
    )
  })
})

// ---------------------------------------------------------------------------
// findPartnerAssignmentsDetail
// ---------------------------------------------------------------------------

describe('findPartnerAssignmentsDetail', () => {
  it('returns assignment detail records', async () => {
    const mockDetail = [
      {
        id: 'assign-1',
        assignment_role: 'pod_leader',
        is_primary: true,
        assigned_at: '2024-01-01T00:00:00Z',
        staff: { id: 'staff-1', full_name: 'Jane Smith', email: 'jane@example.com', role: 'pod_leader' },
      },
    ]
    mockClient.from.mockReturnValue(makeMockChain({ data: mockDetail, error: null }))

    const result = await findPartnerAssignmentsDetail('partner-uuid-1')

    expect(result).toHaveLength(1)
    expect(result[0].assignment_role).toBe('pod_leader')
    expect(mockClient.from).toHaveBeenCalledWith('partner_assignments')
  })

  it('returns empty array when no assignments exist', async () => {
    mockClient.from.mockReturnValue(makeMockChain({ data: [], error: null }))

    const result = await findPartnerAssignmentsDetail('partner-uuid-1')
    expect(result).toEqual([])
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'assignments error' } })
    )

    await expect(
      findPartnerAssignmentsDetail('partner-uuid-1')
    ).rejects.toThrow('Failed to fetch assignments for partner partner-uuid-1: assignments error')
  })
})

// ---------------------------------------------------------------------------
// findPartnerAsins
// ---------------------------------------------------------------------------

describe('findPartnerAsins', () => {
  it('returns ASINs for the partner', async () => {
    const mockAsins = [
      { id: 'asin-1', asin_code: 'B001ABC', title: 'Widget', status: 'active', is_parent: false },
    ]
    mockClient.from.mockReturnValue(makeMockChain({ data: mockAsins, error: null }))

    const result = await findPartnerAsins('partner-uuid-1')

    expect(result).toHaveLength(1)
    expect(result[0].asin_code).toBe('B001ABC')
    expect(mockClient.from).toHaveBeenCalledWith('asins')
  })

  it('returns empty array when partner has no ASINs', async () => {
    mockClient.from.mockReturnValue(makeMockChain({ data: [], error: null }))

    const result = await findPartnerAsins('partner-uuid-1')
    expect(result).toEqual([])
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'asin query failed' } })
    )

    await expect(
      findPartnerAsins('partner-uuid-1')
    ).rejects.toThrow('Failed to fetch ASINs for partner partner-uuid-1: asin query failed')
  })
})

// ---------------------------------------------------------------------------
// findPartnerWeeklyStatuses
// ---------------------------------------------------------------------------

describe('findPartnerWeeklyStatuses', () => {
  it('returns weekly statuses for the partner', async () => {
    const mockStatuses = [
      { id: 'ws-1', week_start_date: '2024-01-01', status: 'Healthy', notes: null },
    ]
    mockClient.from.mockReturnValue(makeMockChain({ data: mockStatuses, error: null }))

    const result = await findPartnerWeeklyStatuses('partner-uuid-1')

    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('Healthy')
    expect(mockClient.from).toHaveBeenCalledWith('weekly_statuses')
  })

  it('returns empty array when no weekly statuses exist', async () => {
    mockClient.from.mockReturnValue(makeMockChain({ data: [], error: null }))

    const result = await findPartnerWeeklyStatuses('partner-uuid-1')
    expect(result).toEqual([])
  })

  it('uses default limit of 156', async () => {
    const chain = makeMockChain({ data: [], error: null })
    mockClient.from.mockReturnValue(chain)

    await findPartnerWeeklyStatuses('partner-uuid-1')

    expect((chain.limit as jest.Mock)).toHaveBeenCalledWith(156)
  })

  it('uses provided limit', async () => {
    const chain = makeMockChain({ data: [], error: null })
    mockClient.from.mockReturnValue(chain)

    await findPartnerWeeklyStatuses('partner-uuid-1', 52)

    expect((chain.limit as jest.Mock)).toHaveBeenCalledWith(52)
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'weekly status error' } })
    )

    await expect(
      findPartnerWeeklyStatuses('partner-uuid-1')
    ).rejects.toThrow('Failed to fetch weekly statuses for partner partner-uuid-1: weekly status error')
  })
})

// ---------------------------------------------------------------------------
// findPartnerFieldLineage
// ---------------------------------------------------------------------------

describe('findPartnerFieldLineage', () => {
  it('returns field lineage records', async () => {
    const mockLineage = [
      {
        field_name: 'brand_name',
        source_type: 'gsheets',
        source_ref: 'Master Client Sheet',
        previous_value: null,
        new_value: 'Acme Corp',
        changed_at: '2024-01-01T00:00:00Z',
        sync_run_id: 'sync-1',
      },
    ]
    mockClient.from.mockReturnValue(makeMockChain({ data: mockLineage, error: null }))

    const result = await findPartnerFieldLineage('partner-uuid-1')

    expect(result).toHaveLength(1)
    expect(result[0].field_name).toBe('brand_name')
    expect(mockClient.from).toHaveBeenCalledWith('field_lineage')
  })

  it('returns empty array when no lineage exists', async () => {
    mockClient.from.mockReturnValue(makeMockChain({ data: [], error: null }))

    const result = await findPartnerFieldLineage('partner-uuid-1')
    expect(result).toEqual([])
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'lineage error' } })
    )

    await expect(
      findPartnerFieldLineage('partner-uuid-1')
    ).rejects.toThrow('Failed to fetch field lineage for partner partner-uuid-1: lineage error')
  })
})

// ---------------------------------------------------------------------------
// findPartnersForReconciliation
// ---------------------------------------------------------------------------

describe('findPartnersForReconciliation', () => {
  it('returns partners for reconciliation', async () => {
    const mockReconciliation = [
      {
        id: 'partner-uuid-1',
        brand_name: 'Acme Corp',
        partner_code: 'ACME',
        computed_partner_type: 'full_service',
      },
    ]
    mockClient.from.mockReturnValue(
      makeMockChain({ data: mockReconciliation, error: null })
    )

    const result = await findPartnersForReconciliation(100)

    expect(result).toHaveLength(1)
    expect(result[0].brand_name).toBe('Acme Corp')
    expect(mockClient.from).toHaveBeenCalledWith('partners')
  })

  it('returns empty array when no partners match', async () => {
    mockClient.from.mockReturnValue(makeMockChain({ data: [], error: null }))

    const result = await findPartnersForReconciliation(100)
    expect(result).toEqual([])
  })

  it('applies search filter when provided', async () => {
    const chain = makeMockChain({ data: [], error: null })
    mockClient.from.mockReturnValue(chain)

    await findPartnersForReconciliation(50, 'Acme')

    expect((chain.or as jest.Mock)).toHaveBeenCalled()
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'reconciliation error' } })
    )

    await expect(
      findPartnersForReconciliation(100)
    ).rejects.toThrow('Failed to fetch partners for reconciliation: reconciliation error')
  })
})

// ---------------------------------------------------------------------------
// updatePartnerTypeFields
// ---------------------------------------------------------------------------

describe('updatePartnerTypeFields', () => {
  const fields = {
    computed_partner_type: 'full_service',
    computed_partner_type_source: 'staffing_sheet',
    partner_type_matches: true,
    partner_type_is_shared: false,
    partner_type_reason: 'matched',
    staffing_partner_type: 'full_service',
    legacy_partner_type: null,
    legacy_partner_type_raw: null,
  }

  it('resolves without error on successful update', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: { id: 'partner-uuid-1' }, error: null })
    )

    await expect(
      updatePartnerTypeFields('partner-uuid-1', fields, '2024-01-01T00:00:00Z')
    ).resolves.toBeUndefined()

    expect(mockClient.from).toHaveBeenCalledWith('partners')
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'update failed' } })
    )

    await expect(
      updatePartnerTypeFields('partner-uuid-1', fields, '2024-01-01T00:00:00Z')
    ).rejects.toThrow('Failed to update partner type fields for partner-uuid-1: update failed')
  })
})
