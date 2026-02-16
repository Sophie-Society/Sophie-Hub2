/**
 * Feedback Service
 *
 * Business logic for feedback, voting, and comments.
 */

import * as feedbackRepo from '@/lib/repositories/feedback.repository'
import type {
  FeedbackItem,
  FeedbackWithVotes,
  FeedbackCreate,
  FeedbackComment,
  FeedbackCommentCreate,
  FeedbackStatus,
  FeedbackType,
} from '@/types/feedback.types'

// =============================================================================
// Feedback
// =============================================================================

export async function submitFeedback(
  input: FeedbackCreate,
  userEmail: string
): Promise<FeedbackItem> {
  return feedbackRepo.createFeedback({
    type: input.type,
    title: input.title,
    description: input.description,
    page_url: input.page_url,
    posthog_session_id: input.posthog_session_id,
    screenshot_url: input.screenshot_data,
    browser_info: input.browser_info,
    submitted_by_email: userEmail,
  })
}

export async function listFeedback(params: {
  type?: FeedbackType
  status?: FeedbackStatus
  mine?: boolean
  sort?: string
  roadmap?: boolean
  userEmail: string
}): Promise<FeedbackWithVotes[]> {
  const feedbackList = await feedbackRepo.findFeedbackList({
    type: params.type,
    status: params.status,
    roadmapOnly: params.roadmap,
    userEmailOnly: params.mine ? params.userEmail : undefined,
    sort: params.sort === 'votes' ? 'votes' : 'recent',
    limit: 100,
  })

  const feedbackIds = feedbackList.map(f => f.id)
  const votedIds = await feedbackRepo.findUserVotesForFeedback(params.userEmail, feedbackIds)
  const votedSet = new Set(votedIds)

  return feedbackList.map(f => ({
    ...f,
    has_voted: votedSet.has(f.id),
  }))
}

export async function updateStatus(
  feedbackId: string,
  status: FeedbackStatus,
  adminNotes?: string
): Promise<FeedbackItem> {
  return feedbackRepo.updateFeedbackStatus(feedbackId, status, adminNotes)
}

// =============================================================================
// Voting
// =============================================================================

export async function toggleVote(
  feedbackId: string,
  userEmail: string
): Promise<{ voted: boolean }> {
  const existingVote = await feedbackRepo.findVoteByUserAndFeedback(userEmail, feedbackId)

  if (existingVote) {
    await feedbackRepo.deleteVote(feedbackId, userEmail)
    return { voted: false }
  }

  await feedbackRepo.createVote(feedbackId, userEmail)
  return { voted: true }
}

export async function removeVote(
  feedbackId: string,
  userEmail: string
): Promise<void> {
  await feedbackRepo.deleteVote(feedbackId, userEmail)
}

// =============================================================================
// Comments
// =============================================================================

export async function listComments(feedbackId: string): Promise<FeedbackComment[]> {
  return feedbackRepo.findCommentsByFeedbackId(feedbackId)
}

export async function addComment(
  feedbackId: string,
  authorEmail: string,
  input: FeedbackCommentCreate
): Promise<FeedbackComment> {
  return feedbackRepo.createComment({
    feedback_id: feedbackId,
    author_email: authorEmail,
    content: input.content,
    is_internal: input.is_internal || false,
  })
}
