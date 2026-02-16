/**
 * Feedback domain types
 *
 * Types for bug reports, feature requests, voting, and comments.
 */

// =============================================================================
// Feedback Items
// =============================================================================

export type FeedbackType = 'bug' | 'feature' | 'question'

export type FeedbackStatus =
  | 'new'
  | 'reviewed'
  | 'in_progress'
  | 'resolved'
  | 'wont_fix'

export interface FeedbackItem {
  id: string
  type: FeedbackType
  title: string | null
  description: string
  page_url: string | null
  posthog_session_id: string | null
  screenshot_url: string | null
  browser_info: Record<string, unknown> | null
  submitted_by_email: string
  status: FeedbackStatus
  vote_count: number
  ai_summary: string | null
  ai_analysis: string | null
  ai_analyzed_at: string | null
  created_at: string
  updated_at: string
}

export interface FeedbackCreate {
  type: FeedbackType
  title?: string | null
  description: string
  page_url?: string
  posthog_session_id?: string | null
  screenshot_data?: string | null
  browser_info?: Record<string, unknown>
}

export interface FeedbackWithVotes extends FeedbackItem {
  has_voted: boolean
}

// =============================================================================
// Feedback Filters
// =============================================================================

export interface FeedbackListParams {
  type?: FeedbackType
  status?: FeedbackStatus
  mine?: boolean
  sort?: 'votes' | 'recent'
  roadmap?: boolean
  userEmail: string
}

// =============================================================================
// Votes
// =============================================================================

export interface FeedbackVote {
  id: string
  feedback_id: string
  user_email: string
  created_at: string
}

// =============================================================================
// Comments
// =============================================================================

export interface FeedbackComment {
  id: string
  feedback_id: string
  author_email: string
  content: string
  is_internal: boolean
  created_at: string
}

export interface FeedbackCommentCreate {
  content: string
  is_internal?: boolean
}

// =============================================================================
// Status Update
// =============================================================================

export interface FeedbackStatusUpdate {
  status: FeedbackStatus
  admin_notes?: string
}
