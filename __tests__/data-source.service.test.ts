/**
 * Tests for data-source.service
 * Covers: createDataSource, getAllDataSourcesWithStats
 */

jest.mock('@/lib/repositories/data-source.repository')
jest.mock('@/lib/connectors', () => ({
  getConnectorRegistry: jest.fn(() => ({
    get: jest.fn().mockReturnValue(null), // no connector = skip validation by default
  })),
}))
jest.mock('@/lib/audit', () => ({
  audit: {
    logDataSource: jest.fn().mockResolvedValue(undefined),
  },
}))

import { createDataSource, getAllDataSourcesWithStats } from '@/lib/services/data-source.service'
import * as dataSourceRepo from '@/lib/repositories/data-source.repository'
import { getConnectorRegistry } from '@/lib/connectors'
import { audit } from '@/lib/audit'

const mockedRepo = jest.mocked(dataSourceRepo)
const mockedGetConnectorRegistry = getConnectorRegistry as jest.Mock
const mockedAudit = audit as jest.Mocked<typeof audit>

const mockSource: dataSourceRepo.DataSourceRecord = {
  id: 'ds-uuid-1',
  name: 'Master Client Sheet',
  type: 'google_sheet',
  spreadsheet_id: 'sheet-abc123',
  spreadsheet_url: 'https://docs.google.com/spreadsheets/d/sheet-abc123',
  connection_config: { type: 'google_sheet', spreadsheet_id: 'sheet-abc123' },
  status: 'active',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  display_order: 1,
}

beforeEach(() => {
  jest.clearAllMocks()
  // Default: no connector found (skip validation)
  mockedGetConnectorRegistry.mockReturnValue({ get: jest.fn().mockReturnValue(null) })
  // Default: audit log always succeeds
  mockedAudit.logDataSource.mockResolvedValue(undefined)
})

// ---------------------------------------------------------------------------
// createDataSource
// ---------------------------------------------------------------------------

describe('createDataSource', () => {
  describe('legacy format (spreadsheet_id)', () => {
    it('creates a new data source when no conflict exists', async () => {
      mockedRepo.findDataSourceBySpreadsheetId.mockResolvedValue(null)
      mockedRepo.createDataSource.mockResolvedValue(mockSource)

      const result = await createDataSource({
        name: 'Master Client Sheet',
        spreadsheet_id: 'sheet-abc123',
        spreadsheet_url: 'https://docs.google.com/spreadsheets/d/sheet-abc123',
        userId: 'user-1',
        userEmail: 'user@example.com',
      })

      expect(result.isConflict).toBe(false)
      expect(result.source).toEqual(mockSource)
    })

    it('returns isConflict=true when a source with that spreadsheet_id already exists', async () => {
      mockedRepo.findDataSourceBySpreadsheetId.mockResolvedValue({ id: 'ds-existing' })

      const result = await createDataSource({
        name: 'Duplicate Sheet',
        spreadsheet_id: 'sheet-abc123',
      })

      expect(result.isConflict).toBe(true)
      expect(result.conflictId).toBe('ds-existing')
      expect(mockedRepo.createDataSource).not.toHaveBeenCalled()
    })

    it('logs an audit entry on successful creation', async () => {
      mockedRepo.findDataSourceBySpreadsheetId.mockResolvedValue(null)
      mockedRepo.createDataSource.mockResolvedValue(mockSource)

      await createDataSource({
        name: 'Master Client Sheet',
        spreadsheet_id: 'sheet-abc123',
        userId: 'user-1',
        userEmail: 'user@example.com',
      })

      expect(mockedAudit.logDataSource).toHaveBeenCalledWith(
        'create',
        'ds-uuid-1',
        'Master Client Sheet',
        'user-1',
        'user@example.com'
      )
    })

    it('does NOT log an audit entry when there is a conflict', async () => {
      mockedRepo.findDataSourceBySpreadsheetId.mockResolvedValue({ id: 'ds-existing' })

      await createDataSource({
        name: 'Duplicate',
        spreadsheet_id: 'sheet-abc123',
      })

      expect(mockedAudit.logDataSource).not.toHaveBeenCalled()
    })
  })

  describe('new format (connection_config)', () => {
    it('creates a data source from connection_config', async () => {
      const connectionConfig = {
        type: 'google_sheet' as const,
        spreadsheet_id: 'sheet-abc123',
        spreadsheet_url: 'https://docs.google.com/spreadsheets/d/sheet-abc123',
      }

      mockedRepo.findDataSourceBySpreadsheetId.mockResolvedValue(null)
      mockedRepo.createDataSource.mockResolvedValue(mockSource)

      const result = await createDataSource({
        name: 'My Sheet',
        connection_config: connectionConfig,
      })

      expect(result.isConflict).toBe(false)
      expect(result.source).toEqual(mockSource)
    })

    it('validates config via connector registry when a connector is found', async () => {
      const mockConnector = {
        validateConfig: jest.fn().mockReturnValue('Invalid API key format'),
      }
      mockedGetConnectorRegistry.mockReturnValue({
        get: jest.fn().mockReturnValue(mockConnector),
      })

      await expect(
        createDataSource({
          name: 'Invalid Config Sheet',
          connection_config: {
            type: 'google_sheet',
            spreadsheet_id: 'bad-id',
          },
        })
      ).rejects.toThrow('Invalid API key format')

      expect(mockedRepo.createDataSource).not.toHaveBeenCalled()
    })

    it('skips validation when connector is not found in registry', async () => {
      mockedGetConnectorRegistry.mockReturnValue({
        get: jest.fn().mockReturnValue(null),
      })
      mockedRepo.findDataSourceBySpreadsheetId.mockResolvedValue(null)
      mockedRepo.createDataSource.mockResolvedValue(mockSource)

      const result = await createDataSource({
        name: 'Unregistered Type',
        connection_config: {
          type: 'google_sheet',
          spreadsheet_id: 'some-id',
        },
      })

      expect(result.isConflict).toBe(false)
    })
  })

  describe('error cases', () => {
    it('throws when neither spreadsheet_id nor connection_config is provided', async () => {
      await expect(
        createDataSource({ name: 'No Source' })
      ).rejects.toThrow('Either spreadsheet_id or connection_config is required')
    })

    it('propagates errors from findDataSourceBySpreadsheetId', async () => {
      mockedRepo.findDataSourceBySpreadsheetId.mockRejectedValue(
        new Error('Failed to check existing data source: db error')
      )

      await expect(
        createDataSource({ name: 'Sheet', spreadsheet_id: 'sheet-id' })
      ).rejects.toThrow('Failed to check existing data source')
    })

    it('propagates errors from createDataSource repo', async () => {
      mockedRepo.findDataSourceBySpreadsheetId.mockResolvedValue(null)
      mockedRepo.createDataSource.mockRejectedValue(
        new Error('Failed to create data source: insert failed')
      )

      await expect(
        createDataSource({ name: 'Sheet', spreadsheet_id: 'sheet-id' })
      ).rejects.toThrow('Failed to create data source')
    })
  })
})

// ---------------------------------------------------------------------------
// getAllDataSourcesWithStats
// ---------------------------------------------------------------------------

describe('getAllDataSourcesWithStats', () => {
  const mockTabs: dataSourceRepo.TabMappingRecord[] = [
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
      total_columns: 20,
    },
  ]

  const mockColumns: dataSourceRepo.ColumnMappingRecord[] = [
    { tab_mapping_id: 'tab-1', category: 'partner' },
    { tab_mapping_id: 'tab-1', category: 'partner' },
    { tab_mapping_id: 'tab-1', category: 'skip' },
  ]

  it('returns empty array when no data sources exist', async () => {
    mockedRepo.getAllDataSources.mockResolvedValue([])

    const result = await getAllDataSourcesWithStats()

    expect(result).toEqual([])
    expect(mockedRepo.getTabMappingsBySourceIds).not.toHaveBeenCalled()
    expect(mockedRepo.getColumnMappingsByTabIds).not.toHaveBeenCalled()
  })

  it('returns assembled data sources with stats', async () => {
    mockedRepo.getAllDataSources.mockResolvedValue([mockSource])
    mockedRepo.getTabMappingsBySourceIds.mockResolvedValue(mockTabs)
    mockedRepo.getColumnMappingsByTabIds.mockResolvedValue(mockColumns)
    mockedRepo.assembleDataSourcesWithStats.mockReturnValue([
      {
        ...mockSource,
        tabCount: 1,
        totalColumns: 20,
        mappedFieldsCount: 2,
        categoryStats: {
          partner: 2, staff: 0, asin: 0, weekly: 0, computed: 0, skip: 1, unmapped: 17,
        },
        tabs: [],
      },
    ])

    const result = await getAllDataSourcesWithStats()

    expect(result).toHaveLength(1)
    expect(result[0].tabCount).toBe(1)
    expect(result[0].mappedFieldsCount).toBe(2)
  })

  it('uses exactly 3 queries total for N data sources (when tabs exist)', async () => {
    const multiSources = [mockSource, { ...mockSource, id: 'ds-uuid-2', name: 'Staff Sheet' }]
    mockedRepo.getAllDataSources.mockResolvedValue(multiSources)
    // Return at least one tab so the 3rd query is triggered
    mockedRepo.getTabMappingsBySourceIds.mockResolvedValue(mockTabs)
    mockedRepo.getColumnMappingsByTabIds.mockResolvedValue([])
    mockedRepo.assembleDataSourcesWithStats.mockReturnValue([])

    await getAllDataSourcesWithStats()

    expect(mockedRepo.getAllDataSources).toHaveBeenCalledTimes(1)
    expect(mockedRepo.getTabMappingsBySourceIds).toHaveBeenCalledTimes(1)
    expect(mockedRepo.getColumnMappingsByTabIds).toHaveBeenCalledTimes(1)
  })

  it('passes all source IDs to getTabMappingsBySourceIds', async () => {
    const multiSources = [mockSource, { ...mockSource, id: 'ds-uuid-2', name: 'Staff Sheet' }]
    mockedRepo.getAllDataSources.mockResolvedValue(multiSources)
    mockedRepo.getTabMappingsBySourceIds.mockResolvedValue([])
    mockedRepo.getColumnMappingsByTabIds.mockResolvedValue([])
    mockedRepo.assembleDataSourcesWithStats.mockReturnValue([])

    await getAllDataSourcesWithStats()

    expect(mockedRepo.getTabMappingsBySourceIds).toHaveBeenCalledWith(
      ['ds-uuid-1', 'ds-uuid-2']
    )
  })

  it('skips getColumnMappingsByTabIds when there are no tabs', async () => {
    mockedRepo.getAllDataSources.mockResolvedValue([mockSource])
    mockedRepo.getTabMappingsBySourceIds.mockResolvedValue([]) // no tabs
    mockedRepo.assembleDataSourcesWithStats.mockReturnValue([])

    await getAllDataSourcesWithStats()

    expect(mockedRepo.getColumnMappingsByTabIds).not.toHaveBeenCalled()
  })

  it('propagates errors from getAllDataSources', async () => {
    mockedRepo.getAllDataSources.mockRejectedValue(
      new Error('Failed to fetch data sources: db error')
    )

    await expect(getAllDataSourcesWithStats()).rejects.toThrow(
      'Failed to fetch data sources'
    )
  })

  it('propagates errors from getTabMappingsBySourceIds', async () => {
    mockedRepo.getAllDataSources.mockResolvedValue([mockSource])
    mockedRepo.getTabMappingsBySourceIds.mockRejectedValue(
      new Error('Failed to fetch tab mappings: network error')
    )

    await expect(getAllDataSourcesWithStats()).rejects.toThrow(
      'Failed to fetch tab mappings'
    )
  })
})
