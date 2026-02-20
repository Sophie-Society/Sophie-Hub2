/**
 * Tests for health.repository
 * Covers: checkDatabaseHealth
 *
 * Note: health.repository calls getAdminClient() inside the function (not at
 * module level), so our mock just returns the persistent client each call.
 */

jest.mock('@/lib/supabase/admin', () => {
  const client = { from: jest.fn() }
  return { getAdminClient: jest.fn(() => client), _client: client }
})

import { checkDatabaseHealth } from '@/lib/repositories/health.repository'

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

type MockResult = {
  data: unknown
  error: { message: string; code?: string } | null
}

function makeMockChain(result: MockResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'limit', 'eq', 'order']
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

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// checkDatabaseHealth
// ---------------------------------------------------------------------------

describe('checkDatabaseHealth', () => {
  it('returns status: up with a numeric latency on successful query', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: [{ id: 'some-id' }], error: null })
    )

    const result = await checkDatabaseHealth()

    expect(result.status).toBe('up')
    expect(typeof result.latencyMs).toBe('number')
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    expect(result.error).toBeUndefined()
  })

  it('returns status: down with error message when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'Database check failed' } })
    )

    const result = await checkDatabaseHealth()

    expect(result.status).toBe('down')
    expect(result.error).toBe('Database check failed')
    expect(typeof result.latencyMs).toBe('number')
  })

  it('returns status: down when getAdminClient throws an exception', async () => {
    mockClient.from.mockImplementation(() => {
      throw new Error('connection timeout')
    })

    const result = await checkDatabaseHealth()

    expect(result.status).toBe('down')
    expect(result.error).toBe('connection timeout')
    expect(typeof result.latencyMs).toBe('number')
  })

  it('handles non-Error exceptions with fallback message', async () => {
    mockClient.from.mockImplementation(() => {
      throw 'string error'
    })

    const result = await checkDatabaseHealth()

    expect(result.status).toBe('down')
    expect(result.error).toBe('Database check failed')
  })

  it('queries the data_sources table', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: [], error: null })
    )

    await checkDatabaseHealth()

    expect(mockClient.from).toHaveBeenCalledWith('data_sources')
  })
})
