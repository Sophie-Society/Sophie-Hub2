import { NextResponse } from 'next/server'
import { requireAuth, requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiValidationError, ApiErrors, ErrorCodes, apiError } from '@/lib/api/response'
import { createLogger } from '@/lib/logger'
import { checkRateLimit, RATE_LIMITS, rateLimitHeaders } from '@/lib/rate-limit'
import * as partnerService from '@/lib/services/partner.service'
import { z } from 'zod'

const log = createLogger('api:partners')

const QuerySchema = z.object({
  search: z.string().max(200).optional(),
  status: z.string().optional(),
  tier: z.string().optional(),
  sort: z.enum(['brand_name', 'created_at', 'tier', 'onboarding_date', 'partner_code', 'client_name', 'pod_leader_name']).optional().default('brand_name'),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
  limit: z.coerce.number().int().min(1).max(5000).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

/**
 * GET /api/partners
 * List partners with search, filter, sort, and pagination.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  const rateLimit = checkRateLimit(auth.user.id, 'partners:list', RATE_LIMITS.PARTNERS_LIST)
  if (!rateLimit.allowed) {
    return ApiErrors.rateLimited('Too many requests. Please wait before fetching partners again.')
  }

  try {
    const { searchParams } = new URL(request.url)
    const params = {
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      tier: searchParams.get('tier') || undefined,
      sort: searchParams.get('sort') || undefined,
      order: searchParams.get('order') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    }

    const validation = QuerySchema.safeParse(params)
    if (!validation.success) {
      return apiError(ErrorCodes.VALIDATION_ERROR, validation.error.message, 400)
    }

    const { search, status, tier, sort, order, limit, offset } = validation.data

    const statusFilters = status
      ? status.split(',').map(s => s.trim()).filter(Boolean)
      : undefined
    const tierFilters = tier
      ? tier.split(',').map(t => t.trim()).filter(Boolean)
      : undefined

    const result = await partnerService.listPartners({
      search,
      statusFilters,
      tier: tierFilters,
      sort,
      order,
      limit,
      offset,
    })

    return apiSuccess(result, 200, {
      'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
      ...rateLimitHeaders(rateLimit),
    })
  } catch (error: unknown) {
    log.error('Failed to list partners', error)
    return ApiErrors.internal()
  }
}

const CreatePartnerSchema = z.object({
  brand_name: z.string().min(1, 'Brand name is required').max(200),
  client_name: z.string().max(200).optional(),
  client_email: z.string().email().optional().or(z.literal('')),
  status: z.enum(['active', 'onboarding', 'paused', 'churned']).optional().default('onboarding'),
  tier: z.enum(['tier_1', 'tier_2', 'tier_3']).optional(),
})

/**
 * POST /api/partners
 * Create a new partner (admin only)
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const body = await request.json()
    const validation = CreatePartnerSchema.safeParse(body)

    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const result = await partnerService.createPartner(validation.data)

    if (result.duplicate) {
      return apiError(ErrorCodes.CONFLICT, `Partner "${validation.data.brand_name}" already exists`, 409)
    }

    return apiSuccess({ partner: result.partner }, 201)
  } catch (error: unknown) {
    log.error('Failed to create partner', error)
    return ApiErrors.internal()
  }
}
