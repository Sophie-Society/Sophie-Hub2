/**
 * Tests for feedback.repository
 * Covers: createFeedback, findFeedback, findUserVotes, findFeedbackById,
 *         findFeedbackVoteCount, findVoteByUser, insertVote, deleteVote
 */

jest.mock('@/lib/supabase/admin', () => {
  const client = { from: jest.fn() }
  return { getAdminClient: jest.fn(() => client), _client: client }
})

import {
  createFeedback,
  findFeedback,
  findUserVotes,
  findFeedbackById,
  findFeedbackVoteCount,
  findVoteByUser,
  insertVote,
  deleteVote,
  type FeedbackInsert,
} from '@/lib/repositories/feedback.repository'

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

const sampleFeedbackInsert: FeedbackInsert = {
  type: 'bug',
  title: 'Login broken',
  description: 'Cannot log in with Google',
  page_url: 'https://app.example.com/login',
  posthog_session_id: 'sess-abc',
  screenshot_url: null,
  browser_info: { browser: 'Chrome', version: '120' },
  submitted_by_email: 'user@example.com',
  status: 'new',
}

const sampleFeedbackRow = {
  id: 'fb-uuid-1',
  type: 'bug',
  title: 'Login broken',
  description: 'Cannot log in with Google',
  status: 'new',
  vote_count: 0,
  created_at: '2024-01-01T00:00:00Z',
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// createFeedback
// ---------------------------------------------------------------------------

describe('createFeedback', () => {
  it('returns the created feedback row on success', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: sampleFeedbackRow, error: null })
    )

    const result = await createFeedback(sampleFeedbackInsert)

    expect(result).toEqual(sampleFeedbackRow)
    expect(mockClient.from).toHaveBeenCalledWith('feedback')
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'insert violation' } })
    )

    await expect(createFeedback(sampleFeedbackInsert)).rejects.toThrow(
      'Failed to create feedback: insert violation'
    )
  })
})

// ---------------------------------------------------------------------------
// findFeedback
// ---------------------------------------------------------------------------

describe('findFeedback', () => {
  const sampleList = [sampleFeedbackRow, { ...sampleFeedbackRow, id: 'fb-uuid-2', type: 'feature' }]

  it('returns all feedback with no filters', async () => {
    mockClient.from.mockReturnValue(makeMockChain({ data: sampleList, error: null }))

    const result = await findFeedback({})

    expect(result).toHaveLength(2)
    expect(mockClient.from).toHaveBeenCalledWith('feedback')
  })

  it('returns empty array when data is null', async () => {
    mockClient.from.mockReturnValue(makeMockChain({ data: null, error: null }))

    const result = await findFeedback({})
    expect(result).toEqual([])
  })

  it('applies type filter for valid types', async () => {
    const chain = makeMockChain({ data: [sampleFeedbackRow], error: null })
    mockClient.from.mockReturnValue(chain)

    await findFeedback({ type: 'bug' })

    expect((chain.eq as jest.Mock)).toHaveBeenCalledWith('type', 'bug')
  })

  it('ignores invalid type filters', async () => {
    const chain = makeMockChain({ data: sampleList, error: null })
    mockClient.from.mockReturnValue(chain)

    await findFeedback({ type: 'invalid_type' })

    // eq should not be called with 'type' since it's not a valid feedback type
    const eqCalls = (chain.eq as jest.Mock).mock.calls
    const typeCall = eqCalls.find((c: unknown[]) => c[0] === 'type')
    expect(typeCall).toBeUndefined()
  })

  it('applies status filter', async () => {
    const chain = makeMockChain({ data: [], error: null })
    mockClient.from.mockReturnValue(chain)

    await findFeedback({ status: 'reviewed' })

    expect((chain.eq as jest.Mock)).toHaveBeenCalledWith('status', 'reviewed')
  })

  it('applies roadmap filter with in()', async () => {
    const chain = makeMockChain({ data: [], error: null })
    mockClient.from.mockReturnValue(chain)

    await findFeedback({ roadmap: true })

    expect((chain.in as jest.Mock)).toHaveBeenCalledWith(
      'status',
      ['reviewed', 'in_progress', 'resolved']
    )
  })

  it('filters by mine+userEmail', async () => {
    const chain = makeMockChain({ data: [sampleFeedbackRow], error: null })
    mockClient.from.mockReturnValue(chain)

    await findFeedback({ mine: true, userEmail: 'user@example.com' })

    expect((chain.eq as jest.Mock)).toHaveBeenCalledWith(
      'submitted_by_email',
      'user@example.com'
    )
  })

  it('does not filter by mine when userEmail is missing', async () => {
    const chain = makeMockChain({ data: sampleList, error: null })
    mockClient.from.mockReturnValue(chain)

    await findFeedback({ mine: true })

    const eqCalls = (chain.eq as jest.Mock).mock.calls
    const emailCall = eqCalls.find((c: unknown[]) => c[0] === 'submitted_by_email')
    expect(emailCall).toBeUndefined()
  })

  it('sorts by votes when sort=votes', async () => {
    const chain = makeMockChain({ data: sampleList, error: null })
    mockClient.from.mockReturnValue(chain)

    await findFeedback({ sort: 'votes' })

    expect((chain.order as jest.Mock)).toHaveBeenCalledWith(
      'vote_count',
      { ascending: false }
    )
  })

  it('uses default sort by created_at when sort is not votes', async () => {
    const chain = makeMockChain({ data: sampleList, error: null })
    mockClient.from.mockReturnValue(chain)

    await findFeedback({})

    expect((chain.order as jest.Mock)).toHaveBeenCalledWith(
      'created_at',
      { ascending: false }
    )
  })

  it('uses provided limit', async () => {
    const chain = makeMockChain({ data: [], error: null })
    mockClient.from.mockReturnValue(chain)

    await findFeedback({ limit: 25 })

    expect((chain.limit as jest.Mock)).toHaveBeenCalledWith(25)
  })

  it('defaults to limit 100', async () => {
    const chain = makeMockChain({ data: [], error: null })
    mockClient.from.mockReturnValue(chain)

    await findFeedback({})

    expect((chain.limit as jest.Mock)).toHaveBeenCalledWith(100)
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'query failed' } })
    )

    await expect(findFeedback({})).rejects.toThrow(
      'Failed to fetch feedback list: query failed'
    )
  })
})

// ---------------------------------------------------------------------------
// findUserVotes
// ---------------------------------------------------------------------------

describe('findUserVotes', () => {
  it('returns empty array immediately when feedbackIds is empty', async () => {
    const result = await findUserVotes('user@example.com', [])
    expect(result).toEqual([])
    expect(mockClient.from).not.toHaveBeenCalled()
  })

  it('returns vote records for the given feedback IDs', async () => {
    const mockVotes = [{ feedback_id: 'fb-1' }, { feedback_id: 'fb-2' }]
    mockClient.from.mockReturnValue(
      makeMockChain({ data: mockVotes, error: null })
    )

    const result = await findUserVotes('user@example.com', ['fb-1', 'fb-2'])

    expect(result).toEqual(mockVotes)
    expect(mockClient.from).toHaveBeenCalledWith('feature_votes')
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'votes fetch failed' } })
    )

    await expect(
      findUserVotes('user@example.com', ['fb-1'])
    ).rejects.toThrow('Failed to fetch user votes: votes fetch failed')
  })
})

// ---------------------------------------------------------------------------
// findFeedbackById
// ---------------------------------------------------------------------------

describe('findFeedbackById', () => {
  it('returns the feedback item when found', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: { id: 'fb-1' }, error: null })
    )

    const result = await findFeedbackById('fb-1')
    expect(result).toEqual({ id: 'fb-1' })
  })

  it('returns null when not found', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: null })
    )

    const result = await findFeedbackById('nonexistent')
    expect(result).toBeNull()
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'db error' } })
    )

    await expect(findFeedbackById('fb-1')).rejects.toThrow(
      'Failed to check feedback fb-1: db error'
    )
  })
})

// ---------------------------------------------------------------------------
// findFeedbackVoteCount
// ---------------------------------------------------------------------------

describe('findFeedbackVoteCount', () => {
  it('returns vote_count when feedback has votes', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: { vote_count: 7 }, error: null })
    )

    const result = await findFeedbackVoteCount('fb-1')
    expect(result).toBe(7)
  })

  it('returns null when feedback is not found', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: null })
    )

    const result = await findFeedbackVoteCount('nonexistent')
    expect(result).toBeNull()
  })

  it('returns null when vote_count is undefined', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: {}, error: null })
    )

    const result = await findFeedbackVoteCount('fb-1')
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// findVoteByUser
// ---------------------------------------------------------------------------

describe('findVoteByUser', () => {
  it('returns the vote when user has voted', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: { id: 'vote-uuid-1' }, error: null })
    )

    const result = await findVoteByUser('fb-1', 'user@example.com')
    expect(result).toEqual({ id: 'vote-uuid-1' })
  })

  it('returns null when user has not voted', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: null })
    )

    const result = await findVoteByUser('fb-1', 'user@example.com')
    expect(result).toBeNull()
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'vote check failed' } })
    )

    await expect(
      findVoteByUser('fb-1', 'user@example.com')
    ).rejects.toThrow('Failed to check vote for feedback fb-1: vote check failed')
  })
})

// ---------------------------------------------------------------------------
// insertVote
// ---------------------------------------------------------------------------

describe('insertVote', () => {
  it('resolves without error on success', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: [{ id: 'vote-new' }], error: null })
    )

    await expect(
      insertVote('fb-1', 'user@example.com')
    ).resolves.toBeUndefined()
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'unique constraint violation' } })
    )

    await expect(
      insertVote('fb-1', 'user@example.com')
    ).rejects.toThrow('Failed to insert vote for feedback fb-1: unique constraint violation')
  })
})

// ---------------------------------------------------------------------------
// deleteVote
// ---------------------------------------------------------------------------

describe('deleteVote', () => {
  it('resolves without error on success', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: [], error: null })
    )

    await expect(
      deleteVote('fb-1', 'user@example.com')
    ).resolves.toBeUndefined()
  })

  it('throws when Supabase returns an error', async () => {
    mockClient.from.mockReturnValue(
      makeMockChain({ data: null, error: { message: 'delete failed' } })
    )

    await expect(
      deleteVote('fb-1', 'user@example.com')
    ).rejects.toThrow('Failed to delete vote for feedback fb-1: delete failed')
  })
})
