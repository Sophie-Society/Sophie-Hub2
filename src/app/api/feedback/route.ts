import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, apiValidationError, ApiErrors } from '@/lib/api/response'
import { createLogger } from '@/lib/logger'
import * as feedbackService from '@/lib/services/feedback.service'
import { z } from 'zod'
import type { FeedbackType, FeedbackStatus } from '@/types/feedback.types'

const log = createLogger('api:feedback')

const FeedbackSchema = z.object({
  type: z.enum(['bug', 'feature', 'question']),
  title: z.string().nullable().optional(),
  description: z.string().min(1, 'Description is required'),
  page_url: z.string().optional(),
  posthog_session_id: z.string().nullable().optional(),
  screenshot_data: z.string().startsWith('data:image/').nullable().optional(),
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

    const feedback = await feedbackService.submitFeedback(validation.data, auth.user.email)
    return apiSuccess({ feedback }, 201)
  } catch (error: unknown) {
    log.error('Failed to create feedback', error)
    return ApiErrors.internal()
  }
}

/**
 * GET /api/feedback
 * List feedback - all staff can see all feedback (Frill-style)
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as FeedbackType | null
    const status = searchParams.get('status') as FeedbackStatus | null
    const mine = searchParams.get('mine') === 'true'
    const sort = searchParams.get('sort') || 'recent'
    const roadmap = searchParams.get('roadmap') === 'true'

    const feedbackWithVotes = await feedbackService.listFeedback({
      type: type && ['bug', 'feature', 'question'].includes(type) ? type : undefined,
      status: status || undefined,
      mine,
      sort,
      roadmap,
      userEmail: auth.user.email,
    })

    return apiSuccess({ feedback: feedbackWithVotes }, 200, {
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=120',
    })
  } catch (error: unknown) {
    log.error('Failed to list feedback', error)
    return ApiErrors.internal()
  }
}
