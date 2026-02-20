/**
 * Tests for settings.repository
 * Covers: findSystemSetting
 */

jest.mock('@/lib/supabase/admin', () => {
  const client = { from: jest.fn() }
  return { getAdminClient: jest.fn(() => client), _client: client }
})

import { findSystemSetting } from '@/lib/repositories/settings.repository'

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

type MockResult = {
  data: unknown
  error: { message: string; code?: string } | null
}

function makeMockChain(result: MockResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'order', 'limit', 'range']
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
// findSystemSetting
// ---------------------------------------------------------------------------

describe('findSystemSetting', () => {
  it('returns a setting row when the key exists', async () => {
    const mockRow = { value: 'sk-ant-abc123', encrypted: true }
    mockClient.from.mockReturnValue(
      makeMockChain({ data: mockRow, error: null })
    )

    const result = await findSystemSetting('anthropic_api_key')

    expect(result).toEqual(mockRow)
    expect(mockClient.from).toHaveBeenCalledWith('system_settings')
  })

  it('returns null when the key does not exist (PGRST116)', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' } })
    )

    const result = await findSystemSetting('nonexistent_key')

    expect(result).toBeNull()
  })

  it('throws on unexpected database errors', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'connection refused', code: '08000' } })
    )

    await expect(findSystemSetting('some_key')).rejects.toThrow(
      'Failed to fetch system setting "some_key": connection refused'
    )
  })

  it('returns setting with encrypted: false for plain text values', async () => {
    const mockRow = { value: 'some-plain-value', encrypted: false }
    mockClient.from.mockReturnValue(
      makeMockChain({ data: mockRow, error: null })
    )

    const result = await findSystemSetting('feature_flag')

    expect(result).not.toBeNull()
    expect(result!.encrypted).toBe(false)
    expect(result!.value).toBe('some-plain-value')
  })

  it('queries the system_settings table with the correct key', async () => {
    const chain = makeMockChain({ data: { value: 'v', encrypted: false }, error: null })
    mockClient.from.mockReturnValue(chain)

    await findSystemSetting('posthog_api_key')

    expect(mockClient.from).toHaveBeenCalledWith('system_settings')
    expect((chain.eq as jest.Mock)).toHaveBeenCalledWith('key', 'posthog_api_key')
  })
})
