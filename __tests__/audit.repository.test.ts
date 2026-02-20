/**
 * Tests for audit.repository
 * Covers: insertAuditLog, findAuditLogs
 */

jest.mock('@/lib/supabase/admin', () => {
  const client = { from: jest.fn() }
  return { getAdminClient: jest.fn(() => client), _client: client }
})

import {
  insertAuditLog,
  findAuditLogs,
  type AuditLogInsert,
} from '@/lib/repositories/audit.repository'

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

const sampleEntry: AuditLogInsert = {
  user_id: 'user-1',
  user_email: 'user@example.com',
  action: 'create',
  resource_type: 'data_source',
  resource_id: 'ds-1',
  resource_name: 'My Sheet',
  changes: null,
  metadata: null,
  ip_address: null,
  user_agent: null,
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// insertAuditLog
// ---------------------------------------------------------------------------

describe('insertAuditLog', () => {
  it('returns the created row id on success', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: { id: 'audit-uuid-1' }, error: null })
    )

    const result = await insertAuditLog(sampleEntry)

    expect(result).toBe('audit-uuid-1')
    expect(mockClient.from).toHaveBeenCalledWith('mapping_audit_log')
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'insert failed' } })
    )

    await expect(insertAuditLog(sampleEntry)).rejects.toThrow(
      'Failed to insert audit log: insert failed'
    )
  })

  it('handles null user fields gracefully', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: { id: 'audit-uuid-2' }, error: null })
    )

    const nullEntry: AuditLogInsert = {
      ...sampleEntry,
      user_id: null,
      user_email: null,
      resource_id: null,
      resource_name: null,
    }

    const result = await insertAuditLog(nullEntry)
    expect(result).toBe('audit-uuid-2')
  })
})

// ---------------------------------------------------------------------------
// findAuditLogs
// ---------------------------------------------------------------------------

describe('findAuditLogs', () => {
  const sampleLogs = [
    { id: 'log-1', action: 'create', resource_type: 'data_source', created_at: '2024-01-01T00:00:00Z' },
    { id: 'log-2', action: 'update', resource_type: 'partner', created_at: '2024-01-02T00:00:00Z' },
  ]

  it('returns an array of audit logs on success', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: sampleLogs, error: null })
    )

    const result = await findAuditLogs(50)

    expect(result).toHaveLength(2)
    expect(result[0]).toHaveProperty('id', 'log-1')
    expect(mockClient.from).toHaveBeenCalledWith('mapping_audit_log')
  })

  it('returns empty array when no logs exist', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: [], error: null })
    )

    const result = await findAuditLogs(50)
    expect(result).toEqual([])
  })

  it('returns empty array when data is null', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: null })
    )

    const result = await findAuditLogs(50)
    expect(result).toEqual([])
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'permission denied' } })
    )

    await expect(findAuditLogs(10)).rejects.toThrow(
      'Failed to fetch audit logs: permission denied'
    )
  })

  it('applies action filter when provided', async () => {
    const chain = makeMockChain({ data: [sampleLogs[0]], error: null })
    mockClient.from.mockReturnValue(chain)

    const result = await findAuditLogs(50, { action: 'create' })

    expect(result).toHaveLength(1)
    expect((chain.eq as jest.Mock)).toHaveBeenCalledWith('action', 'create')
  })

  it('applies resourceType filter when provided', async () => {
    const chain = makeMockChain({ data: [sampleLogs[1]], error: null })
    mockClient.from.mockReturnValue(chain)

    await findAuditLogs(50, { resourceType: 'partner' })

    expect((chain.eq as jest.Mock)).toHaveBeenCalledWith('resource_type', 'partner')
  })

  it('applies resourceId filter when provided', async () => {
    const chain = makeMockChain({ data: [], error: null })
    mockClient.from.mockReturnValue(chain)

    await findAuditLogs(50, { resourceId: 'ds-1' })

    expect((chain.eq as jest.Mock)).toHaveBeenCalledWith('resource_id', 'ds-1')
  })

  it('applies userId filter when provided', async () => {
    const chain = makeMockChain({ data: [], error: null })
    mockClient.from.mockReturnValue(chain)

    await findAuditLogs(50, { userId: 'user-abc' })

    expect((chain.eq as jest.Mock)).toHaveBeenCalledWith('user_id', 'user-abc')
  })
})
