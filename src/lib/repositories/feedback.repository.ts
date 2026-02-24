/**
 * Feedback Repository
 *
 * Handles all database operations for the feedback and feature_votes tables.
 * No business logic — only typed Supabase queries.
 */

import { getAdminClient } from '@/lib/supabase/admin'

const supabase = getAdminClient()

// =============================================================================
// Types
// =============================================================================

export interface FeedbackInsert {
  type: 'bug' | 'feature' | 'question'
  title: string | null | undefined
  description: string
  page_url: string | undefined
  posthog_session_id: string | null | undefined
  screenshot_url: string | null | undefined
  browser_info: Record<string, unknown> | undefined
  submitted_by_email: string
  status: 'new'
}

export interface FeedbackListFilters {
  type?: string
  status?: string
  mine?: boolean
  userEmail?: string
  roadmap?: boolean
  sort?: string
  limit?: number
}

// =============================================================================
// Feedback queries
// =============================================================================

/**
 * Insert a new feedback record. Returns the created row.
 */
export async function createFeedback(
  entry: FeedbackInsert
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from('feedback')
    .insert(entry)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create feedback: ${error.message}`)
  }

  return data as Record<string, unknown>
}

/**
 * List feedback with optional filters and sorting.
 */
export async function findFeedback(
  filters: FeedbackListFilters
): Promise<Record<string, unknown>[]> {
  let query = supabase.from('feedback').select('*')

  if (filters.type && ['bug', 'feature', 'question'].includes(filters.type)) {
    query = query.eq('type', filters.type)
  }

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.roadmap) {
    query = query.in('status', ['reviewed', 'in_progress', 'resolved'])
  }

  if (filters.mine && filters.userEmail) {
    query = query.eq('submitted_by_email', filters.userEmail)
  }

  if (filters.sort === 'votes') {
    query = query
      .order('vote_count', { ascending: false })
      .order('created_at', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  const { data, error } = await query.limit(filters.limit ?? 100)

  if (error) {
    throw new Error(`Failed to fetch feedback list: ${error.message}`)
  }

  return (data || []) as Record<string, unknown>[]
}

/**
 * Fetch user votes for a list of feedback IDs.
 */
export async function findUserVotes(
  userEmail: string,
  feedbackIds: string[]
): Promise<{ feedback_id: string }[]> {
  if (feedbackIds.length === 0) return []

  const { data, error } = await supabase
    .from('feature_votes')
    .select('feedback_id')
    .eq('user_email', userEmail)
    .in('feedback_id', feedbackIds)

  if (error) {
    throw new Error(`Failed to fetch user votes: ${error.message}`)
  }

  return (data || []) as { feedback_id: string }[]
}

/**
 * Check if a feedback item exists by ID.
 */
export async function findFeedbackById(
  id: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('feedback')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to check feedback ${id}: ${error.message}`)
  }

  return data as { id: string } | null
}

/**
 * Fetch vote_count for a feedback item.
 */
export async function findFeedbackVoteCount(
  id: string
): Promise<number | null> {
  const { data } = await supabase
    .from('feedback')
    .select('vote_count')
    .eq('id', id)
    .maybeSingle()

  return (data as { vote_count: number } | null)?.vote_count ?? null
}

// =============================================================================
// Feature votes queries
// =============================================================================

/**
 * Check if a user has voted on a feedback item.
 */
export async function findVoteByUser(
  feedbackId: string,
  userEmail: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('feature_votes')
    .select('id')
    .eq('feedback_id', feedbackId)
    .eq('user_email', userEmail)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to check vote for feedback ${feedbackId}: ${error.message}`)
  }

  return data as { id: string } | null
}

/**
 * Insert a new vote for a feedback item.
 */
export async function insertVote(
  feedbackId: string,
  userEmail: string
): Promise<void> {
  const { error } = await supabase
    .from('feature_votes')
    .insert({ feedback_id: feedbackId, user_email: userEmail })
    .select('id')

  if (error) {
    throw new Error(`Failed to insert vote for feedback ${feedbackId}: ${error.message}`)
  }
}

/**
 * Remove a user's vote from a feedback item.
 */
export async function deleteVote(
  feedbackId: string,
  userEmail: string
): Promise<void> {
  const { error } = await supabase
    .from('feature_votes')
    .delete()
    .eq('feedback_id', feedbackId)
    .eq('user_email', userEmail)
    .select('id')

  if (error) {
    throw new Error(`Failed to delete vote for feedback ${feedbackId}: ${error.message}`)
  }
}
