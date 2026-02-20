/**
 * POST /api/admin/views/[viewId]/fork-dashboard
 *
 * Fork a template dashboard for per-view customization.
 * Auth: isTrueAdmin (excludes operations_admin).
 *
 * Fork decision:
 *   (a) dashboard_id IS NULL → find module template, clone it
 *   (b) dashboard IS NOT NULL AND is_template = true → clone it
 *   (c) dashboard IS NOT NULL AND is_template = false → no-op
 *
 * If no template exists for a module, fallback behavior is:
 *   1) clone from latest dashboard in that module (if any), else
 *   2) create a minimal template dashboard + "Overview" section, then clone.
 */

import { z } from 'zod'
import { requireTrueAdmin } from '@/lib/auth/api-auth'
import { getAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError, ApiErrors, apiValidationError } from '@/lib/api/response'
import { logDashboardFork } from '@/lib/audit/admin-audit'

const ForkSchema = z.object({
  moduleAssignmentId: z.string().uuid(),
})

interface RouteContext {
  params: Promise<{ viewId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireTrueAdmin()
  if (!auth.authenticated) return auth.response

  try {
    const { viewId } = await context.params
    const supabase = getAdminClient()
    const body = await request.json()
    const validation = ForkSchema.safeParse(body)
    if (!validation.success) return apiValidationError(validation.error)

    // Look up assignment with view_id binding (P1-2: cross-view safety)
    const { data: assignment, error: assignmentError } = await supabase
      .from('view_profile_modules')
      .select('id, dashboard_id, module_id')
      .eq('id', validation.data.moduleAssignmentId)
      .eq('view_id', viewId)
      .single()

    if (assignmentError || !assignment) {
      return ApiErrors.notFound('Module assignment')
    }

    // Determine if fork is needed (P1-1: is_template check, not nullability)
    let needsFork = false
    let templateDashboardId: string | null = null

    if (!assignment.dashboard_id) {
      // Case (a): no dashboard assigned at all
      needsFork = true
    } else {
      const { data: dashboard, error: dashError } = await supabase
        .from('dashboards')
        .select('id, is_template')
        .eq('id', assignment.dashboard_id)
        .single()

      if (!dashboard || dashError) {
        // Orphan reference, treat like null
        needsFork = true
      } else if (dashboard.is_template) {
        // Case (b): shared template, must fork
        needsFork = true
        templateDashboardId = dashboard.id
      }
      // else: case (c): already a non-template fork, no-op
    }

    if (!needsFork) {
      return apiSuccess({ dashboardId: assignment.dashboard_id, forked: false })
    }

    // Resolve source dashboard to clone
    if (!templateDashboardId) {
      const { data: templates } = await supabase
        .from('dashboards')
        .select('id')
        .eq('module_id', assignment.module_id)
        .eq('is_template', true)
        .order('updated_at', { ascending: false })
        .limit(1)

      templateDashboardId = templates?.[0]?.id || null
    }

    // No template exists: fallback to latest dashboard in this module (template or non-template).
    if (!templateDashboardId) {
      const { data: fallbackDashboards, error: fallbackError } = await supabase
        .from('dashboards')
        .select('id')
        .eq('module_id', assignment.module_id)
        .order('updated_at', { ascending: false })
        .limit(1)

      if (fallbackError) {
        console.error('Failed to resolve fallback dashboard:', fallbackError)
        return ApiErrors.database()
      }

      templateDashboardId = fallbackDashboards?.[0]?.id || null
    }

    // Absolute fallback: auto-seed a minimal template, then clone from it.
    if (!templateDashboardId) {
      const { data: module } = await supabase
        .from('modules')
        .select('name')
        .eq('id', assignment.module_id)
        .maybeSingle()

      const templateTitle = module?.name ? `${module.name} Template` : 'Template Dashboard'
      const { data: seededTemplate, error: seededTemplateError } = await supabase
        .from('dashboards')
        .insert({
          module_id: assignment.module_id,
          title: templateTitle,
          description: 'Auto-created template dashboard for view composition.',
          is_template: true,
          partner_id: null,
          date_range_default: '30d',
        })
        .select('id')
        .single()

      if (seededTemplateError || !seededTemplate) {
        console.error('Failed to auto-seed template dashboard:', seededTemplateError)
        return ApiErrors.database()
      }

      const { error: seedSectionError } = await supabase
        .from('dashboard_sections')
        .insert({
          dashboard_id: seededTemplate.id,
          title: 'Overview',
          icon_emoji: '•',
          sort_order: 0,
          collapsed: false,
        })

      if (seedSectionError) {
        console.error('Failed to seed template section:', seedSectionError)
        return ApiErrors.database()
      }

      templateDashboardId = seededTemplate.id
    }

    // Fetch template with sections and widgets for cloning
    const { data: template, error: templateError } = await supabase
      .from('dashboards')
      .select('*, dashboard_sections(*, dashboard_widgets(*))')
      .eq('id', templateDashboardId)
      .single()

    if (templateError || !template) {
      return apiError('UNPROCESSABLE_ENTITY', 'Failed to read template dashboard', 422)
    }

    // Clone dashboard row
    const { data: forkedDashboard, error: forkError } = await supabase
      .from('dashboards')
      .insert({
        module_id: template.module_id,
        title: template.title,
        description: template.description,
        is_template: false,
        partner_id: null,
        date_range_default: template.date_range_default,
      })
      .select()
      .single()

    if (forkError || !forkedDashboard) {
      return ApiErrors.database()
    }

    // Clone sections in one batch, then clone all widgets in one batch
    const sections = (template.dashboard_sections || []) as Array<{
      title: string
      icon_emoji: string | null
      sort_order: number
      collapsed: boolean | null
      dashboard_widgets?: Record<string, unknown>[]
    }>

    if (sections.length > 0) {
      // Batch insert all sections — PostgreSQL RETURNING preserves insertion order
      const { data: newSections, error: sectionError } = await supabase
        .from('dashboard_sections')
        .insert(
          sections.map(section => ({
            dashboard_id: forkedDashboard.id,
            title: section.title,
            icon_emoji: section.icon_emoji || null,
            sort_order: section.sort_order,
            collapsed: Boolean(section.collapsed),
          }))
        )
        .select('id')

      if (sectionError || !newSections || newSections.length !== sections.length) {
        console.error('Failed to clone sections:', sectionError)
        return ApiErrors.database()
      }

      // Collect all widgets across all sections using the new section IDs (insertion-order aligned)
      const allWidgets: Record<string, unknown>[] = []
      for (let i = 0; i < sections.length; i++) {
        const newSectionId = newSections[i].id
        const widgets = sections[i].dashboard_widgets || []
        for (const w of widgets) {
          allWidgets.push({
            dashboard_id: forkedDashboard.id,
            section_id: newSectionId,
            widget_type: w.widget_type,
            title: w.title,
            grid_column: w.grid_column,
            grid_row: w.grid_row,
            col_span: w.col_span,
            row_span: w.row_span,
            sort_order: w.sort_order,
            config: w.config || {},
          })
        }
      }

      if (allWidgets.length > 0) {
        const { error: widgetCloneError } = await supabase
          .from('dashboard_widgets')
          .insert(allWidgets)

        if (widgetCloneError) {
          console.error('Failed to clone widgets:', widgetCloneError)
          return ApiErrors.database()
        }
      }
    }

    // Update assignment to point to fork
    const { error: assignmentUpdateError } = await supabase
      .from('view_profile_modules')
      .update({ dashboard_id: forkedDashboard.id })
      .eq('id', assignment.id)

    if (assignmentUpdateError) {
      console.error('Failed to update module assignment with forked dashboard:', assignmentUpdateError)
      return ApiErrors.database()
    }

    logDashboardFork(
      auth.user.id,
      auth.user.email,
      viewId,
      forkedDashboard.id,
      templateDashboardId || forkedDashboard.id,
    )

    return apiSuccess({ dashboardId: forkedDashboard.id, forked: true }, 201)
  } catch (error) {
    console.error('Fork dashboard error:', error)
    return ApiErrors.internal()
  }
}
