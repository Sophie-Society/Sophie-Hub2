/**
 * Tests for partner.service
 * Covers: listPartners, createPartner
 */

jest.mock('@/lib/repositories/partner.repository')
jest.mock('@/lib/partners/computed-status', () => ({
  computePartnerStatus: jest.fn().mockReturnValue({
    computedStatus: 'active',
    displayLabel: 'Active',
    bucket: 'healthy',
    latestWeeklyStatus: 'Healthy',
    matchesSheetStatus: true,
    weeksWithoutData: 0,
  }),
  matchesStatusFilter: jest.fn().mockReturnValue(true),
}))

import { listPartners, createPartner } from '@/lib/services/partner.service'
import * as partnerRepo from '@/lib/repositories/partner.repository'
import { computePartnerStatus, matchesStatusFilter } from '@/lib/partners/computed-status'

const mockedRepo = jest.mocked(partnerRepo)
const mockedComputeStatus = computePartnerStatus as jest.Mock
const mockedMatchesFilter = matchesStatusFilter as jest.Mock

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

const mockPartner2 = {
  ...mockPartner,
  id: 'partner-uuid-2',
  brand_name: 'Beta Brand',
  partner_code: 'BETA',
}

beforeEach(() => {
  jest.clearAllMocks()
  // Default: computePartnerStatus returns healthy computed status
  mockedComputeStatus.mockReturnValue({
    computedStatus: 'active',
    displayLabel: 'Active',
    bucket: 'healthy',
    latestWeeklyStatus: 'Healthy',
    matchesSheetStatus: true,
    weeksWithoutData: 0,
  })
  // Default: status filter matches everything
  mockedMatchesFilter.mockReturnValue(true)
})

// ---------------------------------------------------------------------------
// listPartners
// ---------------------------------------------------------------------------

describe('listPartners', () => {
  const baseQuery = {
    search: undefined,
    tier: undefined,
    status: undefined,
    sort: 'brand_name',
    order: 'asc' as const,
    limit: 20,
    offset: 0,
  }

  it('returns partners with pagination metadata', async () => {
    mockedRepo.findPartners.mockResolvedValue([mockPartner, mockPartner2])
    mockedRepo.findAssignmentsByPartnerIds.mockResolvedValue([])
    mockedRepo.findBigQueryMappings.mockResolvedValue([])

    const result = await listPartners(baseQuery)

    expect(result.partners).toHaveLength(2)
    expect(result.total).toBe(2)
    expect(result.has_more).toBe(false)
  })

  it('returns empty partners when no records exist', async () => {
    mockedRepo.findPartners.mockResolvedValue([])
    mockedRepo.findAssignmentsByPartnerIds.mockResolvedValue([])
    mockedRepo.findBigQueryMappings.mockResolvedValue([])

    const result = await listPartners(baseQuery)

    expect(result.partners).toEqual([])
    expect(result.total).toBe(0)
    expect(result.has_more).toBe(false)
  })

  it('paginates correctly with offset and limit', async () => {
    const allPartners = Array.from({ length: 50 }, (_, i) => ({
      ...mockPartner,
      id: `partner-${i}`,
      brand_name: `Brand ${i}`,
      partner_code: `P${i}`,
    }))

    mockedRepo.findPartners.mockResolvedValue(allPartners)
    mockedRepo.findAssignmentsByPartnerIds.mockResolvedValue([])
    mockedRepo.findBigQueryMappings.mockResolvedValue([])

    const result = await listPartners({ ...baseQuery, limit: 10, offset: 0 })

    expect(result.partners).toHaveLength(10)
    expect(result.total).toBe(50)
    expect(result.has_more).toBe(true)
  })

  it('has_more is false when on the last page', async () => {
    const allPartners = Array.from({ length: 5 }, (_, i) => ({
      ...mockPartner,
      id: `partner-${i}`,
      brand_name: `Brand ${i}`,
      partner_code: `P${i}`,
    }))

    mockedRepo.findPartners.mockResolvedValue(allPartners)
    mockedRepo.findAssignmentsByPartnerIds.mockResolvedValue([])
    mockedRepo.findBigQueryMappings.mockResolvedValue([])

    const result = await listPartners({ ...baseQuery, limit: 10, offset: 0 })

    expect(result.has_more).toBe(false)
  })

  it('applies status filter by passing through computed status logic', async () => {
    mockedRepo.findPartners.mockResolvedValue([mockPartner, mockPartner2])
    mockedRepo.findAssignmentsByPartnerIds.mockResolvedValue([])
    mockedRepo.findBigQueryMappings.mockResolvedValue([])

    // matchesStatusFilter returns false for all — should filter out all partners
    mockedMatchesFilter.mockReturnValue(false)

    const result = await listPartners({ ...baseQuery, status: 'healthy' })

    expect(result.total).toBe(0)
    expect(result.partners).toHaveLength(0)
  })

  it('splits tier query string into array for findPartners', async () => {
    mockedRepo.findPartners.mockResolvedValue([mockPartner])
    mockedRepo.findAssignmentsByPartnerIds.mockResolvedValue([])
    mockedRepo.findBigQueryMappings.mockResolvedValue([])

    await listPartners({ ...baseQuery, tier: 'tier_1,tier_2' })

    expect(mockedRepo.findPartners).toHaveBeenCalledWith(
      expect.objectContaining({
        tierFilters: ['tier_1', 'tier_2'],
      })
    )
  })

  it('attaches pod_leader from assignments lookup', async () => {
    mockedRepo.findPartners.mockResolvedValue([mockPartner])
    mockedRepo.findAssignmentsByPartnerIds.mockResolvedValue([
      {
        partner_id: 'partner-uuid-1',
        assignment_role: 'pod_leader',
        staff: { id: 'staff-1', full_name: 'Jane Smith' },
      },
    ])
    mockedRepo.findBigQueryMappings.mockResolvedValue([])

    const result = await listPartners(baseQuery)

    expect(result.partners[0].pod_leader).toEqual({ id: 'staff-1', full_name: 'Jane Smith' })
  })

  it('attaches sales_rep from assignments lookup', async () => {
    mockedRepo.findPartners.mockResolvedValue([mockPartner])
    mockedRepo.findAssignmentsByPartnerIds.mockResolvedValue([
      {
        partner_id: 'partner-uuid-1',
        assignment_role: 'sales_rep',
        staff: { id: 'staff-2', full_name: 'Bob Jones' },
      },
    ])
    mockedRepo.findBigQueryMappings.mockResolvedValue([])

    const result = await listPartners(baseQuery)

    expect(result.partners[0].sales_rep).toEqual({ id: 'staff-2', full_name: 'Bob Jones' })
  })

  it('sets has_bigquery=true when BigQuery mapping exists', async () => {
    mockedRepo.findPartners.mockResolvedValue([mockPartner])
    mockedRepo.findAssignmentsByPartnerIds.mockResolvedValue([])
    mockedRepo.findBigQueryMappings.mockResolvedValue([
      { entity_id: 'partner-uuid-1', external_id: 'acme-bq-name' },
    ])

    const result = await listPartners(baseQuery)

    expect(result.partners[0].has_bigquery).toBe(true)
    expect(result.partners[0].bigquery_client_name).toBe('acme-bq-name')
  })

  it('sets has_bigquery=false when no BigQuery mapping exists', async () => {
    mockedRepo.findPartners.mockResolvedValue([mockPartner])
    mockedRepo.findAssignmentsByPartnerIds.mockResolvedValue([])
    mockedRepo.findBigQueryMappings.mockResolvedValue([])

    const result = await listPartners(baseQuery)

    expect(result.partners[0].has_bigquery).toBe(false)
    expect(result.partners[0].bigquery_client_name).toBeNull()
  })

  it('propagates errors from findPartners', async () => {
    mockedRepo.findPartners.mockRejectedValue(new Error('db connection failed'))

    await expect(listPartners(baseQuery)).rejects.toThrow('db connection failed')
  })

  it('only fetches assignments and bq mappings for the current page', async () => {
    const allPartners = Array.from({ length: 50 }, (_, i) => ({
      ...mockPartner,
      id: `partner-${i}`,
      brand_name: `Brand ${i}`,
      partner_code: `P${i}`,
    }))

    mockedRepo.findPartners.mockResolvedValue(allPartners)
    mockedRepo.findAssignmentsByPartnerIds.mockResolvedValue([])
    mockedRepo.findBigQueryMappings.mockResolvedValue([])

    await listPartners({ ...baseQuery, limit: 10, offset: 0 })

    // Should only pass the 10 paginated partner IDs, not all 50
    const passedIds = mockedRepo.findAssignmentsByPartnerIds.mock.calls[0][0]
    expect(passedIds).toHaveLength(10)
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

  it('creates and returns a new partner when no duplicate exists', async () => {
    mockedRepo.findPartnerByBrandName.mockResolvedValue(null)
    mockedRepo.createPartner.mockResolvedValue({
      ...mockPartner,
      brand_name: 'New Brand',
      id: 'new-partner-uuid',
    })

    const result = await createPartner(createInput)

    expect(result.isConflict).toBe(false)
    if (!result.isConflict) {
      expect(result.partner.brand_name).toBe('New Brand')
    }
  })

  it('returns isConflict=true when a partner with that brand name already exists', async () => {
    mockedRepo.findPartnerByBrandName.mockResolvedValue({ id: 'existing-partner-uuid' })

    const result = await createPartner(createInput)

    expect(result.isConflict).toBe(true)
    if (result.isConflict) {
      expect(result.brandName).toBe('New Brand')
    }
    // createPartner repo function should NOT have been called
    expect(mockedRepo.createPartner).not.toHaveBeenCalled()
  })

  it('propagates errors from findPartnerByBrandName', async () => {
    mockedRepo.findPartnerByBrandName.mockRejectedValue(
      new Error('Failed to check existing partner: network error')
    )

    await expect(createPartner(createInput)).rejects.toThrow('Failed to check existing partner')
  })

  it('propagates errors from createPartner repo', async () => {
    mockedRepo.findPartnerByBrandName.mockResolvedValue(null)
    mockedRepo.createPartner.mockRejectedValue(
      new Error('Failed to create partner: not null violation')
    )

    await expect(createPartner(createInput)).rejects.toThrow('Failed to create partner')
  })
})
