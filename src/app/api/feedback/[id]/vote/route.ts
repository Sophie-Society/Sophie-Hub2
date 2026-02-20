import { getAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:feedback:vote')

const supabase = getAdminClient()

/**
 * POST /api/feedback/[id]/vote
 * Add vote to feedback (current user)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  const { id } = await params

  try {
    // Check if feedback exists
    // Cat-4: .maybeSingle() — feedback might not exist for a given id
    const { data: feedback, error: feedbackError } = await supabase
      .from('feedback')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (feedbackError || !feedback) {
      return ApiErrors.notFound('Feedback')
    }

    // Check if user already voted
    // Cat-4: .maybeSingle() — vote may not exist yet
    const { data: existingVote } = await supabase
      .from('feature_votes')
      .select('id')
      .eq('feedback_id', id)
      .eq('user_email', auth.user.email)
      .maybeSingle()

    if (existingVote) {
      return ApiErrors.conflict('You have already voted on this idea')
    }

    // Add vote
    // H-7: .select('id') returns the inserted row without a second round-trip
    const { error: voteError } = await supabase
      .from('feature_votes')
      .insert({
        feedback_id: id,
        user_email: auth.user.email,
      })
      .select('id')

    if (voteError) {
      log.error('Failed to add vote', { err: voteError, feedbackId: id })
      return ApiErrors.database()
    }

    // Get updated vote count
    // Cat-4: .maybeSingle() — feedback could theoretically be deleted between insert and this query
    const { data: updated } = await supabase
      .from('feedback')
      .select('vote_count')
      .eq('id', id)
      .maybeSingle()

    return apiSuccess({
      voted: true,
      vote_count: updated?.vote_count || 1
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
) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  const { id } = await params

  try {
    // Check if user has voted
    // Cat-4: .maybeSingle() — vote may not exist
    const { data: existingVote } = await supabase
      .from('feature_votes')
      .select('id')
      .eq('feedback_id', id)
      .eq('user_email', auth.user.email)
      .maybeSingle()

    if (!existingVote) {
      return ApiErrors.notFound('Vote')
    }

    // Remove vote
    // H-7: .select('id') returns the deleted row without a second round-trip
    const { error: deleteError } = await supabase
      .from('feature_votes')
      .delete()
      .eq('feedback_id', id)
      .eq('user_email', auth.user.email)
      .select('id')

    if (deleteError) {
      log.error('Failed to remove vote', { err: deleteError, feedbackId: id })
      return ApiErrors.database()
    }

    // Get updated vote count
    // Cat-4: .maybeSingle() — feedback could theoretically be deleted between delete and this query
    const { data: updated } = await supabase
      .from('feedback')
      .select('vote_count')
      .eq('id', id)
      .maybeSingle()

    return apiSuccess({
      voted: false,
      vote_count: updated?.vote_count || 0
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
) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  const { id } = await params

  try {
    // Cat-4: .maybeSingle() — vote may not exist (returns null, not error)
    const { data: vote } = await supabase
      .from('feature_votes')
      .select('id')
      .eq('feedback_id', id)
      .eq('user_email', auth.user.email)
      .maybeSingle()

    return apiSuccess({ voted: !!vote })
  } catch (error) {
    log.error('Unexpected error in GET vote', error)
    return ApiErrors.internal()
  }
}
