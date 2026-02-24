'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { PreviewModule } from '@/lib/views/module-nav'
import type { DashboardWidget, DashboardWithChildren, DateRange, WidgetDataMode } from '@/types/modules'
import { SectionContainer } from '@/components/reporting/section-container'
import { ShimmerBar, ShimmerGrid } from '@/components/ui/shimmer-grid'
import { sendToParent } from '@/lib/views/preview-bridge'
import { usePreviewContext } from './preview-context'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PreviewModuleContentProps {
  module: PreviewModule
  showTitle?: boolean
  onSectionsResolved?: (
    moduleSlug: string,
    sections: Array<{ id: string; title: string; iconEmoji: string | null }>
  ) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders the content for a selected module in the preview shell.
 *
 * Uses the same section/widget container primitives as the module builder so
 * drag/resize snap behavior is consistent in Views preview edit mode.
 */
export function PreviewModuleContent({
  module,
  showTitle = true,
  onSectionsResolved,
}: PreviewModuleContentProps) {
  const { viewId, dataMode, subjectType, targetId, isEditMode } = usePreviewContext()
  const sectionEditMode = isEditMode
  const [dashboard, setDashboard] = useState<DashboardWithChildren | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectivePartnerId = subjectType === 'partner' ? targetId || undefined : undefined
  const effectiveDataMode: WidgetDataMode = subjectType === 'partner' ? dataMode : 'snapshot'

  const defaultDateRange = useMemo<DateRange>(() => ({
    preset: (
      dashboard?.date_range_default &&
      ['7d', '14d', '30d', '60d', '90d', 'mtd', 'last_month', 'ytd', '365d', 'custom'].includes(dashboard.date_range_default)
    ) ? (dashboard.date_range_default as DateRange['preset']) : '30d',
  }), [dashboard?.date_range_default])

  useEffect(() => {
    if (!module.dashboardId) {
      setDashboard(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/modules/dashboards/${module.dashboardId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load dashboard')
        return res.json()
      })
      .then((json) => {
        if (!cancelled) {
          setDashboard(json.data?.dashboard ?? json.dashboard ?? null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [module.dashboardId])

  const sortedSections = useMemo(() => {
    if (!dashboard?.sections) return []
    return [...dashboard.sections]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((section) => ({
        ...section,
        widgets: [...section.widgets].sort((a, b) => a.sort_order - b.sort_order),
      }))
  }, [dashboard?.sections])

  useEffect(() => {
    onSectionsResolved?.(
      module.slug,
      sortedSections.map((section) => ({
        id: section.id,
        title: section.title,
        iconEmoji: section.icon_emoji ?? null,
      }))
    )
  }, [module.slug, onSectionsResolved, sortedSections])

  const patchWidget = useCallback(async (widgetId: string, updates: Partial<DashboardWidget>) => {
    if (!module.dashboardId) return
    const res = await fetch(`/api/admin/views/${viewId}/widgets`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dashboardId: module.dashboardId,
        widget_id: widgetId,
        ...updates,
      }),
    })

    if (!res.ok) {
      throw new Error('Failed to update widget')
    }
  }, [module.dashboardId, viewId])

  const deleteWidget = useCallback(async (widgetId: string) => {
    if (!module.dashboardId) return
    const res = await fetch(`/api/admin/views/${viewId}/widgets`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dashboardId: module.dashboardId,
        widget_id: widgetId,
      }),
    })

    if (!res.ok) {
      throw new Error('Failed to delete widget')
    }
  }, [module.dashboardId, viewId])

  function updateWidgetLocal(widgetId: string, updater: (widget: DashboardWidget) => DashboardWidget) {
    setDashboard((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        sections: prev.sections.map((section) => ({
          ...section,
          widgets: section.widgets.map((widget) =>
            widget.id === widgetId ? updater(widget) : widget
          ),
        })),
      }
    })
  }

  function removeWidgetLocal(widgetId: string) {
    setDashboard((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        sections: prev.sections.map((section) => ({
          ...section,
          widgets: section.widgets.filter((widget) => widget.id !== widgetId),
        })),
      }
    })
  }

  async function handleMoveWidget(widgetId: string, gridColumn: number, gridRow: number) {
    const previous = dashboard
    updateWidgetLocal(widgetId, (widget) => ({
      ...widget,
      grid_column: gridColumn,
      grid_row: gridRow,
    }))
    try {
      await patchWidget(widgetId, { grid_column: gridColumn, grid_row: gridRow })
      sendToParent({ type: 'compositionSaved' })
    } catch {
      setDashboard(previous)
      toast.error('Failed to move widget')
    }
  }

  async function handleResizeWidget(widgetId: string, colSpan: number, rowSpan: number) {
    const previous = dashboard
    updateWidgetLocal(widgetId, (widget) => ({
      ...widget,
      col_span: colSpan,
      row_span: rowSpan,
    }))
    try {
      await patchWidget(widgetId, { col_span: colSpan, row_span: rowSpan })
      sendToParent({ type: 'compositionSaved' })
    } catch {
      setDashboard(previous)
      toast.error('Failed to resize widget')
    }
  }

  async function handleDeleteWidget(widgetId: string) {
    const previous = dashboard
    removeWidgetLocal(widgetId)
    try {
      await deleteWidget(widgetId)
      sendToParent({ type: 'compositionSaved' })
    } catch {
      setDashboard(previous)
      toast.error('Failed to delete widget')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {showTitle && (
          <div className="space-y-2">
            <ShimmerBar width={320} height={24} />
            <ShimmerBar width={420} height={14} />
          </div>
        )}

        <div className="rounded-xl border border-border/50 bg-background p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShimmerBar width={14} height={14} className="rounded-full" />
              <ShimmerBar width={160} height={18} />
            </div>
            <ShimmerBar width={72} height={16} />
          </div>
          <ShimmerGrid rows={2} columns={2} cellHeight={140} gap={12} />
        </div>

        <div className="rounded-xl border border-border/50 bg-background p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShimmerBar width={14} height={14} className="rounded-full" />
              <ShimmerBar width={190} height={18} />
            </div>
            <ShimmerBar width={72} height={16} />
          </div>
          <ShimmerGrid rows={1} columns={2} cellHeight={120} gap={12} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (!module.dashboardId || !dashboard) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-lg border border-dashed border-border p-8">
          <h3 className="text-sm font-medium">{module.name}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            No dashboard configured for this module yet.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-2">
            Select this module, then click Edit to clone/create a dashboard for this view.
          </p>
        </div>
      </div>
    )
  }

  // Render dashboard sections and widgets
  return (
    <div className="space-y-6">
      {showTitle && (
        <div>
          <h2 className="text-lg font-semibold">{dashboard.title || module.name}</h2>
          {dashboard.description && (
            <p className="text-sm text-muted-foreground mt-1">{dashboard.description}</p>
          )}
        </div>
      )}

      {sortedSections.length > 0 ? (
        <div className="space-y-8">
          {sortedSections.map((section) => {
            const sectionForRender = sectionEditMode && section.collapsed
              ? { ...section, collapsed: false }
              : section

            return (
              <div key={section.id} id={`preview-section-${section.id}`}>
              <SectionContainer
                section={sectionForRender}
                dateRange={defaultDateRange}
                partnerId={effectivePartnerId}
                dataMode={effectiveDataMode}
                refreshTick={0}
                forceRefreshToken={0}
                isEditMode={sectionEditMode}
                onAddWidget={(sectionId) => {
                  if (!sectionEditMode) return
                  sendToParent({
                    type: 'addWidgetRequested',
                    sectionId,
                    dashboardId: dashboard.id,
                  })
                }}
                onEditWidget={(widget) => {
                  if (!sectionEditMode) return
                  sendToParent({
                    type: 'widgetEditRequested',
                    widgetId: widget.id,
                    sectionId: section.id,
                    dashboardId: dashboard.id,
                  })
                }}
                onDeleteWidget={(widgetId) => {
                  void handleDeleteWidget(widgetId)
                }}
                onToggleCollapse={() => {
                  // Keep collapse state local in preview for now.
                }}
                onMoveWidget={(widgetId, col, row) => {
                  void handleMoveWidget(widgetId, col, row)
                }}
                onResizeWidget={(widgetId, colSpan, rowSpan) => {
                  void handleResizeWidget(widgetId, colSpan, rowSpan)
                }}
                allowCollapse={false}
              />
            </div>
            )
          })}
        </div>
      ) : (
        <div>
          <p className="text-sm text-muted-foreground">This dashboard has no sections yet.</p>
          {sectionEditMode && (
            <p className="text-xs text-muted-foreground/70 mt-1">
              Use the Settings drawer to add sections.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
