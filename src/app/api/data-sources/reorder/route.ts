import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/api-auth'
import { apiSuccess, apiValidationError, ApiErrors } from '@/lib/api/response'
import { DataSourceSchema } from '@/lib/validations/schemas'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api:data-sources:reorder')

// POST - Reorder data sources (admin only)
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requirePermission('data-enrichment:write')
  if (!auth.authenticated) return auth.response

  try {
    const supabase = getAdminClient()
    const body = await request.json()

    // Validate input
    const validation = DataSourceSchema.reorder.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { sourceIds } = validation.data

    // Update each source with its new display_order
    const updates = sourceIds.map((id, index) =>
      supabase
        .from('data_sources')
        .update({ display_order: index })
        .eq('id', id)
    )

    await Promise.all(updates)

    return apiSuccess({ reordered: true })
  } catch (error: unknown) {
    logger.error('Error reordering sources', error)
    return ApiErrors.database('Failed to reorder sources')
  }
}
