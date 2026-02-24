import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, apiValidationError, ApiErrors } from '@/lib/api/response'
import {
  createFeedback,
  findFeedback,
  findUserVotes,
} from '@/lib/repositories/feedback.repository'
import { z } from 'zod'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:feedback')

const FeedbackSchema = z.object({
  type: z.enum(['bug', 'feature', 'question']),
  title: z.string().nullable().optional(),
  description: z.string().min(1, 'Description is required'),
  page_url: z.string().optional(),
  posthog_session_id: z.string().nullable().optional(),
  screenshot_data: z.string().startsWith('data:image/').nullable().optional(), // base64 image data
  browser_info: z.record(z.string(), z.unknown()).optional(),
})

/**
 * POST /api/feedback
 * Submit new feedback (bug, feature request, or question)
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  try {
    const body = await request.json()
    const validation = FeedbackSchema.safeParse(body)

    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { type, title, description, page_url, posthog_session_id, screenshot_data, browser_info } = validation.data

    const feedback = await createFeedback({
      type,
      title,
      description,
      page_url,
      posthog_session_id,
      screenshot_url: screenshot_data,
      browser_info,
      submitted_by_email: auth.user.email,
      status: 'new',
    })

    return apiSuccess({ feedback }, 201)
  } catch (error) {
    log.error('Unexpected error in POST /api/feedback', error)
    return ApiErrors.internal()
  }
}

/**
 * GET /api/feedback
 * List feedback - all staff can see all feedback (Frill-style)
 *
 * Query params:
 * - type: bug | feature | question
 * - status: new | reviewed | in_progress | resolved | wont_fix
 * - mine: true - show only current user's feedback
 * - sort: votes | recent (default: recent)
 * - roadmap: true - show only roadmap items (reviewed, in_progress, resolved)
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const status = searchParams.get('status')
  const mine = searchParams.get('mine') === 'true'
  const sort = searchParams.get('sort') || 'recent'
  const roadmap = searchParams.get('roadmap') === 'true'

  try {
    const feedback = await findFeedback({
      type: type ?? undefined,
      status: status ?? undefined,
      mine,
      userEmail: auth.user.email,
      roadmap,
      sort,
    })

    // Get current user's votes to mark which items they've voted on
    const feedbackIds = feedback.map(f => f.id as string)
    let userVotes: Set<string> = new Set()

    if (feedbackIds.length > 0) {
      try {
        const votes = await findUserVotes(auth.user.email, feedbackIds)
        userVotes = new Set(votes.map(v => v.feedback_id))
      } catch (err) {
        // Non-fatal: return feedback without vote status rather than failing the whole request
        log.warn('Failed to fetch user votes for feedback list', { err })
      }
    }

    // Add has_voted flag to each feedback item
    const feedbackWithVotes = feedback.map(f => ({
      ...f,
      has_voted: userVotes.has(f.id as string),
    }))

    return apiSuccess({ feedback: feedbackWithVotes }, 200, {
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=120',
    })
  } catch (error) {
    log.error('Unexpected error in GET /api/feedback', error)
    return ApiErrors.internal()
  }
}
