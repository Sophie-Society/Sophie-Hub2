/**
 * Tests for data-source.repository
 * Covers: findDataSourceBySpreadsheetId, createDataSource, getAllDataSources,
 *         getTabMappingsBySourceIds, getColumnMappingsByTabIds,
 *         assembleDataSourcesWithStats (pure function)
 */

jest.mock('@/lib/supabase/admin', () => {
  const client = { from: jest.fn() }
  return { getAdminClient: jest.fn(() => client), _client: client }
})

import {
  findDataSourceBySpreadsheetId,
  createDataSource,
  getAllDataSources,
  getTabMappingsBySourceIds,
  getColumnMappingsByTabIds,
  assembleDataSourcesWithStats,
  type CreateDataSourceInput,
  type DataSourceRecord,
  type TabMappingRecord,
  type ColumnMappingRecord,
} from '@/lib/repositories/data-source.repository'

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

const mockSource: DataSourceRecord = {
  id: 'ds-uuid-1',
  name: 'Master Client Sheet',
  type: 'google_sheet',
  spreadsheet_id: 'abc123spreadsheetId',
  spreadsheet_url: 'https://docs.google.com/spreadsheets/d/abc123',
  connection_config: { type: 'google_sheet', spreadsheet_id: 'abc123spreadsheetId' },
  status: 'active',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  display_order: 1,
}

const createInput: CreateDataSourceInput = {
  name: 'My Sheet',
  type: 'google_sheet',
  spreadsheet_id: 'sheet-xyz',
  spreadsheet_url: 'https://docs.google.com/spreadsheets/d/sheet-xyz',
  connection_config: { type: 'google_sheet', spreadsheet_id: 'sheet-xyz' },
  status: 'active',
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// findDataSourceBySpreadsheetId
// ---------------------------------------------------------------------------

describe('findDataSourceBySpreadsheetId', () => {
  it('returns the existing data source id when found', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: { id: 'ds-uuid-1' }, error: null })
    )

    const result = await findDataSourceBySpreadsheetId('abc123spreadsheetId')

    expect(result).toEqual({ id: 'ds-uuid-1' })
    expect(mockClient.from).toHaveBeenCalledWith('data_sources')
  })

  it('returns null when no matching source exists', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: null })
    )

    const result = await findDataSourceBySpreadsheetId('unknown-id')
    expect(result).toBeNull()
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'query error' } })
    )

    await expect(
      findDataSourceBySpreadsheetId('some-id')
    ).rejects.toThrow('Failed to check existing data source: query error')
  })
})

// ---------------------------------------------------------------------------
// createDataSource
// ---------------------------------------------------------------------------

describe('createDataSource', () => {
  it('returns the newly created data source record', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: mockSource, error: null })
    )

    const result = await createDataSource(createInput)

    expect(result).toEqual(mockSource)
    expect(mockClient.from).toHaveBeenCalledWith('data_sources')
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'duplicate key' } })
    )

    await expect(createDataSource(createInput)).rejects.toThrow(
      'Failed to create data source: duplicate key'
    )
  })

  it('throws when data is null (no data returned)', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: null })
    )

    await expect(createDataSource(createInput)).rejects.toThrow(
      'Data source creation returned no data'
    )
  })
})

// ---------------------------------------------------------------------------
// getAllDataSources
// ---------------------------------------------------------------------------

describe('getAllDataSources', () => {
  it('returns all data sources ordered by display_order', async () => {
    const sources = [mockSource]
    mockClient.from.mockReturnValue(
      makeMockChain({ data: sources, error: null })
    )

    const result = await getAllDataSources()

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(mockSource)
  })

  it('returns empty array when no sources exist', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: [], error: null })
    )

    const result = await getAllDataSources()
    expect(result).toEqual([])
  })

  it('returns empty array when data is null', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: null })
    )

    const result = await getAllDataSources()
    expect(result).toEqual([])
  })

  it('falls back to created_at ordering when display_order column does not exist (42703)', async () => {
    const fallbackSources = [mockSource]
    // First call returns 42703 error, second call succeeds
    mockClient.from
      .mockReturnValueOnce(
        makeMockChain({ data: null, error: { message: 'column not found', code: '42703' } })
      )
      .mockReturnValueOnce(
        makeMockChain({ data: fallbackSources, error: null })
      )

    const result = await getAllDataSources()

    expect(result).toHaveLength(1)
    expect(mockClient.from).toHaveBeenCalledTimes(2)
  })

  it('throws when the fallback query also fails', async () => {
    mockClient.from
      .mockReturnValueOnce(
        makeMockChain({ data: null, error: { message: 'no display_order', code: '42703' } })
      )
      .mockReturnValueOnce(
        makeMockChain({ data: null, error: { message: 'fallback failed' } })
      )

    await expect(getAllDataSources()).rejects.toThrow(
      'Failed to fetch data sources: fallback failed'
    )
  })

  it('throws for non-42703 errors', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'permission denied', code: '42501' } })
    )

    await expect(getAllDataSources()).rejects.toThrow(
      'Failed to fetch data sources: permission denied'
    )
  })
})

// ---------------------------------------------------------------------------
// getTabMappingsBySourceIds
// ---------------------------------------------------------------------------

describe('getTabMappingsBySourceIds', () => {
  it('returns empty array immediately when sourceIds is empty', async () => {
    const result = await getTabMappingsBySourceIds([])
    expect(result).toEqual([])
    expect(mockClient.from).not.toHaveBeenCalled()
  })

  it('returns tab mappings for given source IDs', async () => {
    const mockTabs: Partial<TabMappingRecord>[] = [
      {
        id: 'tab-1',
        data_source_id: 'ds-uuid-1',
        tab_name: 'Partners',
        primary_entity: 'partners',
        header_row: 9,
        header_confirmed: true,
        status: 'active',
        notes: null,
        updated_at: '2024-01-01T00:00:00Z',
        total_columns: 30,
      },
    ]
    mockClient.from.mockReturnValue(
      makeMockChain({ data: mockTabs, error: null })
    )

    const result = await getTabMappingsBySourceIds(['ds-uuid-1'])

    expect(result).toHaveLength(1)
    expect(result[0].tab_name).toBe('Partners')
    expect(mockClient.from).toHaveBeenCalledWith('tab_mappings')
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'tab query failed' } })
    )

    await expect(
      getTabMappingsBySourceIds(['ds-1'])
    ).rejects.toThrow('Failed to fetch tab mappings: tab query failed')
  })
})

// ---------------------------------------------------------------------------
// getColumnMappingsByTabIds
// ---------------------------------------------------------------------------

describe('getColumnMappingsByTabIds', () => {
  it('returns empty array immediately when tabIds is empty', async () => {
    const result = await getColumnMappingsByTabIds([])
    expect(result).toEqual([])
    expect(mockClient.from).not.toHaveBeenCalled()
  })

  it('returns column mappings for given tab IDs', async () => {
    const mockColumns: ColumnMappingRecord[] = [
      { tab_mapping_id: 'tab-1', category: 'partner' },
      { tab_mapping_id: 'tab-1', category: 'skip' },
    ]
    mockClient.from.mockReturnValue(
      makeMockChain({ data: mockColumns, error: null })
    )

    const result = await getColumnMappingsByTabIds(['tab-1'])

    expect(result).toHaveLength(2)
    expect(mockClient.from).toHaveBeenCalledWith('column_mappings')
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'column query failed' } })
    )

    await expect(
      getColumnMappingsByTabIds(['tab-1'])
    ).rejects.toThrow('Failed to fetch column mappings: column query failed')
  })
})

// ---------------------------------------------------------------------------
// assembleDataSourcesWithStats (pure function — no DB calls)
// ---------------------------------------------------------------------------

describe('assembleDataSourcesWithStats', () => {
  const sources: DataSourceRecord[] = [mockSource]

  it('returns empty array when sources is empty', () => {
    const result = assembleDataSourcesWithStats([], [], [])
    expect(result).toEqual([])
  })

  it('returns a source with zero stats when no tabs exist', () => {
    const result = assembleDataSourcesWithStats(sources, [], [])

    expect(result).toHaveLength(1)
    expect(result[0].tabCount).toBe(0)
    expect(result[0].totalColumns).toBe(0)
    expect(result[0].mappedFieldsCount).toBe(0)
  })

  it('calculates tabCount correctly', () => {
    const tabs: TabMappingRecord[] = [
      { id: 'tab-1', data_source_id: mockSource.id, tab_name: 'Tab A', primary_entity: 'partners', header_row: 0, header_confirmed: true, status: 'active', notes: null, updated_at: null, total_columns: 5 },
      { id: 'tab-2', data_source_id: mockSource.id, tab_name: 'Tab B', primary_entity: 'staff', header_row: 0, header_confirmed: null, status: 'active', notes: null, updated_at: null, total_columns: 3 },
    ]

    const result = assembleDataSourcesWithStats(sources, tabs, [])

    expect(result[0].tabCount).toBe(2)
    expect(result[0].totalColumns).toBe(8)
  })

  it('counts category stats from column mappings', () => {
    const tabs: TabMappingRecord[] = [
      { id: 'tab-1', data_source_id: mockSource.id, tab_name: 'Tab A', primary_entity: 'partners', header_row: 0, header_confirmed: true, status: 'active', notes: null, updated_at: null, total_columns: 4 },
    ]
    const columns: ColumnMappingRecord[] = [
      { tab_mapping_id: 'tab-1', category: 'partner' },
      { tab_mapping_id: 'tab-1', category: 'partner' },
      { tab_mapping_id: 'tab-1', category: 'skip' },
      { tab_mapping_id: 'tab-1', category: 'staff' },
    ]

    const result = assembleDataSourcesWithStats(sources, tabs, columns)

    expect(result[0].categoryStats.partner).toBe(2)
    expect(result[0].categoryStats.skip).toBe(1)
    expect(result[0].categoryStats.staff).toBe(1)
    // mappedFieldsCount excludes 'skip' category
    expect(result[0].mappedFieldsCount).toBe(3)
  })

  it('counts unsaved columns as unmapped', () => {
    const tabs: TabMappingRecord[] = [
      { id: 'tab-1', data_source_id: mockSource.id, tab_name: 'Tab A', primary_entity: 'partners', header_row: 0, header_confirmed: true, status: 'active', notes: null, updated_at: null, total_columns: 10 },
    ]
    const columns: ColumnMappingRecord[] = [
      { tab_mapping_id: 'tab-1', category: 'partner' }, // only 1 of 10 saved
    ]

    const result = assembleDataSourcesWithStats(sources, tabs, columns)
    const tab = result[0].tabs[0]

    // 10 total - 1 saved = 9 unmapped
    expect(tab.categoryStats.unmapped).toBe(9)
  })

  it('handles tabs with unknown category gracefully', () => {
    const tabs: TabMappingRecord[] = [
      { id: 'tab-1', data_source_id: mockSource.id, tab_name: 'Tab A', primary_entity: 'partners', header_row: 0, header_confirmed: true, status: 'active', notes: null, updated_at: null, total_columns: 2 },
    ]
    const columns: ColumnMappingRecord[] = [
      { tab_mapping_id: 'tab-1', category: 'unknown_category' },
      { tab_mapping_id: 'tab-1', category: 'partner' },
    ]

    const result = assembleDataSourcesWithStats(sources, tabs, columns)
    // unknown category counted as unmapped
    expect(result[0].categoryStats.unmapped).toBe(1)
    expect(result[0].categoryStats.partner).toBe(1)
  })

  it('defaults tab status to active when status is null', () => {
    const tabs: TabMappingRecord[] = [
      { id: 'tab-1', data_source_id: mockSource.id, tab_name: 'Tab A', primary_entity: null, header_row: 0, header_confirmed: null, status: null, notes: null, updated_at: null, total_columns: null },
    ]

    const result = assembleDataSourcesWithStats(sources, tabs, [])
    expect(result[0].tabs[0].status).toBe('active')
  })
})
