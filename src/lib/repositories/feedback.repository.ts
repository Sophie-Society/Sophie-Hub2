/**
 * Feedback Repository
 *
 * All Supabase queries for feedback, votes, and comments.
 */

import { getAdminClient } from '@/lib/supabase/admin'
import type {
  FeedbackItem,
  FeedbackStatus,
  FeedbackType,
  FeedbackVote,
  FeedbackComment,
} from '@/types/feedback.types'

// =============================================================================
// Feedback CRUD
// =============================================================================

export async function createFeedback(input: {
  type: FeedbackType
  title?: string | null
  description: string
  page_url?: string
  posthog_session_id?: string | null
  screenshot_url?: string | null
  browser_info?: Record<string, unknown>
  submitted_by_email: string
}): Promise<FeedbackItem> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('feedback')
    .insert({
      ...input,
      status: 'new' as const,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create feedback: ${error.message}`)
  return data as FeedbackItem
}

export async function findFeedbackList(params: {
  type?: FeedbackType
  status?: FeedbackStatus
  roadmapOnly?: boolean
  userEmailOnly?: string
  sort: 'votes' | 'recent'
  limit: number
}): Promise<FeedbackItem[]> {
  const supabase = getAdminClient()
  let query = supabase.from('feedback').select('*')

  if (params.type) {
    query = query.eq('type', params.type)
  }

  if (params.status) {
    query = query.eq('status', params.status)
  }

  if (params.roadmapOnly) {
    query = query.in('status', ['reviewed', 'in_progress', 'resolved'])
  }

  if (params.userEmailOnly) {
    query = query.eq('submitted_by_email', params.userEmailOnly)
  }

  if (params.sort === 'votes') {
    query = query.order('vote_count', { ascending: false }).order('created_at', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  const { data, error } = await query.limit(params.limit)

  if (error) throw new Error(`Failed to fetch feedback: ${error.message}`)
  return (data || []) as FeedbackItem[]
}

export async function findFeedbackById(id: string): Promise<FeedbackItem | null> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch feedback: ${error.message}`)
  return data as FeedbackItem | null
}

export async function updateFeedbackStatus(
  id: string,
  status: FeedbackStatus,
  adminNotes?: string
): Promise<FeedbackItem> {
  const supabase = getAdminClient()
  const updates: Record<string, unknown> = { status }
  if (adminNotes !== undefined) {
    updates.admin_notes = adminNotes
  }

  const { data, error } = await supabase
    .from('feedback')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Failed to update feedback status: ${error.message}`)
  return data as FeedbackItem
}

// =============================================================================
// Votes
// =============================================================================

export async function findUserVotesForFeedback(
  userEmail: string,
  feedbackIds: string[]
): Promise<string[]> {
  if (feedbackIds.length === 0) return []

  const supabase = getAdminClient()
  const { data } = await supabase
    .from('feature_votes')
    .select('feedback_id')
    .eq('user_email', userEmail)
    .in('feedback_id', feedbackIds)

  return (data || []).map(v => v.feedback_id as string)
}

export async function findVoteByUserAndFeedback(
  userEmail: string,
  feedbackId: string
): Promise<FeedbackVote | null> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('feature_votes')
    .select('*')
    .eq('feedback_id', feedbackId)
    .eq('user_email', userEmail)
    .maybeSingle()

  if (error) throw new Error(`Failed to check vote: ${error.message}`)
  return data as FeedbackVote | null
}

export async function createVote(feedbackId: string, userEmail: string): Promise<FeedbackVote> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('feature_votes')
    .insert({ feedback_id: feedbackId, user_email: userEmail })
    .select()
    .single()

  if (error) throw new Error(`Failed to create vote: ${error.message}`)
  return data as FeedbackVote
}

export async function deleteVote(feedbackId: string, userEmail: string): Promise<void> {
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('feature_votes')
    .delete()
    .eq('feedback_id', feedbackId)
    .eq('user_email', userEmail)

  if (error) throw new Error(`Failed to delete vote: ${error.message}`)
}

// =============================================================================
// Comments
// =============================================================================

export async function findCommentsByFeedbackId(feedbackId: string): Promise<FeedbackComment[]> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('feedback_comments')
    .select('*')
    .eq('feedback_id', feedbackId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to fetch comments: ${error.message}`)
  return (data || []) as FeedbackComment[]
}

export async function createComment(input: {
  feedback_id: string
  author_email: string
  content: string
  is_internal: boolean
}): Promise<FeedbackComment> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('feedback_comments')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(`Failed to create comment: ${error.message}`)
  return data as FeedbackComment
}
