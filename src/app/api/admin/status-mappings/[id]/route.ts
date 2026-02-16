import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { getAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError, ApiErrors, ErrorCodes, apiValidationError } from '@/lib/api/response'
import { createLogger } from '@/lib/logger'
import { z } from 'zod'
import { invalidateMappingsCache } from '@/lib/status-colors/cache'

const log = createLogger('api:admin:status-mappings:id')

const VALID_BUCKETS = ['healthy', 'onboarding', 'warning', 'paused', 'offboarding', 'churned'] as const

const UpdateMappingSchema = z.object({
  status_pattern: z.string().min(1).max(100).transform(s => s.toLowerCase().trim()).optional(),
  bucket: z.enum(VALID_BUCKETS).optional(),
  priority: z.number().int().min(0).max(200).optional(),
  is_active: z.boolean().optional(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * PUT /api/admin/status-mappings/[id]
 * Updates a status color mapping (admin only)
 */
export async function PUT(request: Request, context: RouteContext): Promise<NextResponse> {
  const authResult = await requireRole(ROLES.ADMIN)
  if (!authResult.authenticated) return authResult.response

  try {
    const { id } = await context.params
    const body = await request.json()
    const validation = UpdateMappingSchema.safeParse(body)

    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const updates = validation.data
    const supabase = getAdminClient()

    const { data: existing, error: fetchError } = await supabase
      .from('status_color_mappings')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return ApiErrors.notFound('Status mapping')
    }

    if (existing.is_system_default) {
      const allowedUpdates: Record<string, unknown> = {}
      if (updates.is_active !== undefined) {
        allowedUpdates.is_active = updates.is_active
      }

      if (Object.keys(allowedUpdates).length === 0) {
        return apiError(ErrorCodes.FORBIDDEN, 'System default mappings can only have their active status toggled', 403)
      }

      const { data: mapping, error } = await supabase
        .from('status_color_mappings')
        .update(allowedUpdates)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        return ApiErrors.database()
      }

      invalidateMappingsCache()
      return apiSuccess({ mapping })
    }

    if (updates.status_pattern && updates.status_pattern !== existing.status_pattern) {
      const { data: duplicate } = await supabase
        .from('status_color_mappings')
        .select('id')
        .eq('status_pattern', updates.status_pattern)
        .neq('id', id)
        .maybeSingle()

      if (duplicate) {
        return apiError(ErrorCodes.CONFLICT, `Pattern "${updates.status_pattern}" already exists`, 409)
      }
    }

    const { data: mapping, error } = await supabase
      .from('status_color_mappings')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return ApiErrors.database()
    }

    invalidateMappingsCache()
    return apiSuccess({ mapping })
  } catch (error: unknown) {
    log.error('Status mapping update error', error)
    return ApiErrors.internal()
  }
}

/**
 * DELETE /api/admin/status-mappings/[id]
 * Deletes a status color mapping (admin only, not system defaults)
 */
export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  const authResult = await requireRole(ROLES.ADMIN)
  if (!authResult.authenticated) return authResult.response

  try {
    const { id } = await context.params
    const supabase = getAdminClient()

    const { data: existing, error: fetchError } = await supabase
      .from('status_color_mappings')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return ApiErrors.notFound('Status mapping')
    }

    if (existing.is_system_default) {
      return apiError(ErrorCodes.FORBIDDEN, 'System default mappings cannot be deleted. You can deactivate them instead.', 403)
    }

    const { error } = await supabase
      .from('status_color_mappings')
      .delete()
      .eq('id', id)

    if (error) {
      return ApiErrors.database()
    }

    invalidateMappingsCache()
    return apiSuccess({ deleted: true })
  } catch (error: unknown) {
    log.error('Status mapping deletion error', error)
    return ApiErrors.internal()
  }
}
