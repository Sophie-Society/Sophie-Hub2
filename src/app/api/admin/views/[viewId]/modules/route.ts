import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { getAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, ApiErrors, apiValidationError } from '@/lib/api/response'
import { logModuleAssign, logModuleRemove, logViewChange } from '@/lib/audit/admin-audit'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:admin:views:modules')

const CreateAssignmentSchema = z.object({
  module_id: z.string().uuid(),
  dashboard_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
  config: z.record(z.string(), z.unknown()).optional().default({}),
})

const DeleteAssignmentSchema = z.object({
  module_id: z.string().uuid(),
})

const UpdateModuleLayoutSchema = z.object({
  module_id: z.string().uuid(),
  layout: z.object({
    grid_column: z.number().int().min(1).max(8),
    grid_row: z.number().int().min(1),
    col_span: z.number().int().min(1).max(8),
    row_span: z.number().int().min(1).max(6),
  }).superRefine((value, ctx) => {
    if (value.grid_column + value.col_span - 1 > 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'layout exceeds 8-column grid',
        path: ['col_span'],
      })
    }
  }),
})

interface RouteContext {
  params: Promise<{ viewId: string }>
}

/**
 * GET /api/admin/views/[viewId]/modules
 *
 * Returns assigned modules for a view ordered by sort_order.
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const { viewId } = await context.params
    const supabase = getAdminClient()

    const { data: view, error: viewError } = await supabase
      .from('view_profiles')
      .select('id')
      .eq('id', viewId)
      .single()

    if (viewError || !view) return ApiErrors.notFound('View profile')

    const { data: assignments, error } = await supabase
      .from('view_profile_modules')
      .select('id, view_id, module_id, dashboard_id, sort_order, config')
      .eq('view_id', viewId)
      .order('sort_order', { ascending: true })

    if (error) {
      log.error('Failed to fetch view modules', error)
      return ApiErrors.database(error.message)
    }

    const moduleIds = Array.from(new Set((assignments || []).map((row) => row.module_id)))
    let modulesById = new Map<string, {
      id: string
      slug: string
      name: string
      description: string | null
      icon: string | null
      color: string | null
      sort_order: number
    }>()

    if (moduleIds.length > 0) {
      const { data: modules, error: modulesError } = await supabase
        .from('modules')
        .select('id, slug, name, description, icon, color, sort_order')
        .in('id', moduleIds)

      if (modulesError) {
        log.error('Failed to fetch module metadata', modulesError)
      } else {
        modulesById = new Map((modules || []).map((module) => [module.id, module]))
      }
    }

    const normalizedAssignments = (assignments || []).map((assignment) => ({
      ...assignment,
      modules: modulesById.get(assignment.module_id) || null,
    }))

    return apiSuccess({ assignments: normalizedAssignments })
  } catch (error) {
    log.error('View modules fetch error', error)
    return ApiErrors.internal()
  }
}

/**
 * POST /api/admin/views/[viewId]/modules
 *
 * Assign a module to a view.
 */
export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const { viewId } = await context.params
    const supabase = getAdminClient()
    const body = await request.json()
    const validation = CreateAssignmentSchema.safeParse(body)
    if (!validation.success) return apiValidationError(validation.error)

    const { module_id, dashboard_id, config } = validation.data

    const { data: view, error: viewError } = await supabase
      .from('view_profiles')
      .select('id, slug')
      .eq('id', viewId)
      .single()

    if (viewError || !view) return ApiErrors.notFound('View profile')

    const { data: module, error: moduleError } = await supabase
      .from('modules')
      .select('id')
      .eq('id', module_id)
      .single()

    if (moduleError || !module) return ApiErrors.notFound('Module')

    let sortOrder = validation.data.sort_order
    if (sortOrder === undefined) {
      const { data: latest } = await supabase
        .from('view_profile_modules')
        .select('sort_order')
        .eq('view_id', viewId)
        .order('sort_order', { ascending: false })
        .limit(1)

      sortOrder = latest?.[0]?.sort_order !== undefined
        ? Number(latest[0].sort_order) + 1
        : 0
    }

    // Blank-slate by default: assigning a module does not auto-attach a dashboard.
    // Dashboards are attached explicitly via fork/edit flows.
    const resolvedDashboardId = dashboard_id ?? null

    const { data: assignment, error } = await supabase
      .from('view_profile_modules')
      .insert({
        view_id: viewId,
        module_id,
        dashboard_id: resolvedDashboardId,
        sort_order: sortOrder,
        config,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return ApiErrors.conflict('This module is already assigned to the view')
      }
      log.error('Failed to assign module to view', error)
      return ApiErrors.database(error.message)
    }

    logModuleAssign(auth.user.id, auth.user.email, viewId, view.slug, module_id)

    return apiSuccess({ assignment }, 201)
  } catch (error) {
    log.error('View module assignment error', error)
    return ApiErrors.internal()
  }
}

/**
 * DELETE /api/admin/views/[viewId]/modules
 *
 * Remove a module assignment from a view.
 */
export async function DELETE(request: Request, context: RouteContext): Promise<NextResponse | Response> {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const { viewId } = await context.params
    const supabase = getAdminClient()
    const body = await request.json()
    const validation = DeleteAssignmentSchema.safeParse(body)
    if (!validation.success) return apiValidationError(validation.error)

    const { module_id } = validation.data

    const { data: view, error: viewError } = await supabase
      .from('view_profiles')
      .select('id, slug')
      .eq('id', viewId)
      .single()

    if (viewError || !view) return ApiErrors.notFound('View profile')

    const { data: existing, error: existingError } = await supabase
      .from('view_profile_modules')
      .select('id')
      .eq('view_id', viewId)
      .eq('module_id', module_id)
      .maybeSingle()

    if (existingError) {
      log.error('Failed checking module assignment', existingError)
      return ApiErrors.database(existingError.message)
    }

    if (!existing) {
      return ApiErrors.notFound('Module assignment')
    }

    const { error } = await supabase
      .from('view_profile_modules')
      .delete()
      .eq('view_id', viewId)
      .eq('module_id', module_id)

    if (error) {
      log.error('Failed to delete module assignment', error)
      return ApiErrors.database(error.message)
    }

    logModuleRemove(auth.user.id, auth.user.email, viewId, view.slug, module_id)

    return new Response(null, { status: 204 })
  } catch (error) {
    log.error('View module removal error', error)
    return ApiErrors.internal()
  }
}

/**
 * PATCH /api/admin/views/[viewId]/modules
 *
 * Update module assignment layout metadata for module-as-widget composition.
 */
export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const { viewId } = await context.params
    const supabase = getAdminClient()
    const body = await request.json()
    const validation = UpdateModuleLayoutSchema.safeParse(body)
    if (!validation.success) return apiValidationError(validation.error)

    const { module_id, layout } = validation.data

    const { data: view, error: viewError } = await supabase
      .from('view_profiles')
      .select('id, slug')
      .eq('id', viewId)
      .single()

    if (viewError || !view) return ApiErrors.notFound('View profile')

    const { data: assignment, error: assignmentError } = await supabase
      .from('view_profile_modules')
      .select('id, config')
      .eq('view_id', viewId)
      .eq('module_id', module_id)
      .maybeSingle()

    if (assignmentError) {
      return ApiErrors.database(assignmentError.message)
    }

    if (!assignment) {
      return ApiErrors.notFound('Module assignment')
    }

    const nextConfig = {
      ...(assignment.config && typeof assignment.config === 'object' ? assignment.config : {}),
      layout,
    }

    const { data: updated, error: updateError } = await supabase
      .from('view_profile_modules')
      .update({ config: nextConfig })
      .eq('id', assignment.id)
      .select('id, view_id, module_id, dashboard_id, sort_order, config')
      .single()

    if (updateError) {
      return ApiErrors.database(updateError.message)
    }

    void logViewChange(
      'view.update',
      auth.user.id,
      auth.user.email,
      viewId,
      view.slug,
      {
        module_id,
        module_layout: layout,
      }
    )

    return apiSuccess({ assignment: updated })
  } catch (error) {
    log.error('View module layout update error', error)
    return ApiErrors.internal()
  }
}
