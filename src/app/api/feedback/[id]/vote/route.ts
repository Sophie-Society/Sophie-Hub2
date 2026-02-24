import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import {
  findFeedbackById,
  findVoteByUser,
  insertVote,
  deleteVote,
  findFeedbackVoteCount,
} from '@/lib/repositories/feedback.repository'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:feedback:vote')

/**
 * POST /api/feedback/[id]/vote
 * Add vote to feedback (current user)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  const { id } = await params

  try {
    const feedback = await findFeedbackById(id)
    if (!feedback) {
      return ApiErrors.notFound('Feedback')
    }

    const existingVote = await findVoteByUser(id, auth.user.email)
    if (existingVote) {
      return ApiErrors.conflict('You have already voted on this idea')
    }

    await insertVote(id, auth.user.email)

    const voteCount = await findFeedbackVoteCount(id)

    return apiSuccess({
      voted: true,
      vote_count: voteCount ?? 1,
    }, 201)
  } catch (error) {
    log.error('Unexpected error in POST vote', error)
    return ApiErrors.internal()
  }
}

/**
 * DELETE /api/feedback/[id]/vote
 * Remove vote from feedback (current user)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  const { id } = await params

  try {
    const existingVote = await findVoteByUser(id, auth.user.email)
    if (!existingVote) {
      return ApiErrors.notFound('Vote')
    }

    await deleteVote(id, auth.user.email)

    const voteCount = await findFeedbackVoteCount(id)

    return apiSuccess({
      voted: false,
      vote_count: voteCount ?? 0,
    })
  } catch (error) {
    log.error('Unexpected error in DELETE vote', error)
    return ApiErrors.internal()
  }
}

/**
 * GET /api/feedback/[id]/vote
 * Check if current user has voted
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  const { id } = await params

  try {
    const vote = await findVoteByUser(id, auth.user.email)
    return apiSuccess({ voted: !!vote })
  } catch (error) {
    log.error('Unexpected error in GET vote', error)
    return ApiErrors.internal()
  }
}
