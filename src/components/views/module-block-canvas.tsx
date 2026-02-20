'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragMoveEvent, DragStartEvent } from '@dnd-kit/core'
import { Move, Package, Pencil, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GridCell } from '@/components/reporting/grid-cell'
import type { CellHighlight } from '@/components/reporting/grid-cell'
import { WidgetWrapper } from '@/components/reporting/widget-wrapper'
import {
  GRID_COLS,
  findDropPosition,
  getCellsForPlacement,
  getMaxRow,
  pointerToCell,
  useOccupancyMap,
} from '@/hooks/use-grid-occupancy'
import type { DashboardWidget } from '@/types/modules'
import type { PreviewModule } from '@/lib/views/module-nav'

interface ModuleBlockCanvasProps {
  modules: PreviewModule[]
  isEditMode: boolean
  activeModuleSlug: string | null
  onSelectModule: (slug: string) => void
  onPersistLayout: (moduleId: string, layout: {
    grid_column: number
    grid_row: number
    col_span: number
    row_span: number
  }) => Promise<boolean>
}

interface ModuleLayout {
  grid_column: number
  grid_row: number
  col_span: number
  row_span: number
}

interface ModuleBlock {
  module: PreviewModule
  layout: ModuleLayout
}

function defaultLayout(index: number): ModuleLayout {
  if (index === 0) {
    return { grid_column: 1, grid_row: 1, col_span: 8, row_span: 1 }
  }

  const idx = index - 1
  const row = Math.floor(idx / 2) + 2
  const col = idx % 2 === 0 ? 1 : 5
  return {
    grid_column: col,
    grid_row: row,
    col_span: 4,
    row_span: 1,
  }
}

function normalizeModules(modules: PreviewModule[]): ModuleBlock[] {
  return modules.map((module, index) => ({
    module,
    layout: {
      grid_column: module.gridColumn ?? defaultLayout(index).grid_column,
      grid_row: module.gridRow ?? defaultLayout(index).grid_row,
      col_span: module.colSpan ?? defaultLayout(index).col_span,
      row_span: module.rowSpan ?? defaultLayout(index).row_span,
    },
  }))
}

function toWidget(block: ModuleBlock): DashboardWidget {
  return {
    id: block.module.moduleId,
    dashboard_id: block.module.dashboardId || block.module.moduleId,
    section_id: 'module-blocks',
    widget_type: 'text',
    title: block.module.name,
    grid_column: block.layout.grid_column,
    grid_row: block.layout.grid_row,
    col_span: block.layout.col_span,
    row_span: block.layout.row_span,
    sort_order: block.module.sortOrder,
    config: {
      content: '',
      alignment: 'left',
    },
    created_at: '1970-01-01T00:00:00.000Z',
    updated_at: '1970-01-01T00:00:00.000Z',
  }
}

function upsertLayout(
  blocks: ModuleBlock[],
  moduleId: string,
  patch: Partial<ModuleLayout>,
): ModuleBlock[] {
  return blocks.map((block) => {
    if (block.module.moduleId !== moduleId) return block
    return {
      ...block,
      layout: {
        ...block.layout,
        ...patch,
      },
    }
  })
}

export function ModuleBlockCanvas({
  modules,
  isEditMode,
  activeModuleSlug,
  onSelectModule,
  onPersistLayout,
}: ModuleBlockCanvasProps) {
  const [blocks, setBlocks] = useState<ModuleBlock[]>(() => normalizeModules(modules))
  const [activeWidget, setActiveWidget] = useState<DashboardWidget | null>(null)
  const [dropTarget, setDropTarget] = useState<{ col: number; row: number } | null>(null)
  const [dropValid, setDropValid] = useState(false)
  const [gridDimensions, setGridDimensions] = useState({ cellWidth: 180, rowHeight: 150 })
  const gridRef = useRef<HTMLDivElement>(null)
  const gridRectRef = useRef<DOMRect | null>(null)

  useEffect(() => {
    setBlocks(normalizeModules(modules))
  }, [modules])

  const widgets = useMemo(() => blocks.map(toWidget), [blocks])
  const occupancyMap = useOccupancyMap(widgets)
  const maxRow = useMemo(() => Math.max(getMaxRow(widgets), 1), [widgets])
  const totalRows = activeWidget ? maxRow + 1 : maxRow

  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const measure = () => {
      const gap = 12
      const cellWidth = (el.offsetWidth - gap * (GRID_COLS - 1)) / GRID_COLS
      setGridDimensions({ cellWidth, rowHeight: 150 })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (!isEditMode) return
    const widget = widgets.find((item) => item.id === event.active.id)
    if (!widget) return
    setActiveWidget(widget)
    if (gridRef.current) {
      gridRectRef.current = gridRef.current.getBoundingClientRect()
    }
  }, [isEditMode, widgets])

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    if (!activeWidget || !gridRectRef.current) return

    const pointerX = (event.activatorEvent as PointerEvent).clientX + (event.delta?.x ?? 0)
    const pointerY = (event.activatorEvent as PointerEvent).clientY + (event.delta?.y ?? 0)
    const cell = pointerToCell(
      pointerX,
      pointerY,
      gridRectRef.current,
      gridDimensions.cellWidth,
      gridDimensions.rowHeight,
      12
    )

    if (!cell) {
      setDropTarget(null)
      setDropValid(false)
      return
    }

    const pos = findDropPosition(
      occupancyMap,
      cell.col,
      cell.row,
      activeWidget.col_span,
      activeWidget.row_span,
      activeWidget.id
    )

    if (pos) {
      setDropTarget(pos)
      setDropValid(true)
    } else {
      setDropTarget({ col: cell.col, row: cell.row })
      setDropValid(false)
    }
  }, [activeWidget, gridDimensions.cellWidth, gridDimensions.rowHeight, occupancyMap])

  const handleDragCancel = useCallback(() => {
    setActiveWidget(null)
    setDropTarget(null)
    setDropValid(false)
    gridRectRef.current = null
  }, [])

  const handleDragEnd = useCallback(async () => {
    if (activeWidget && dropTarget && dropValid) {
      const previous = blocks
      const next = upsertLayout(blocks, activeWidget.id, {
        grid_column: dropTarget.col,
        grid_row: dropTarget.row,
      })

      setBlocks(next)
      const ok = await onPersistLayout(activeWidget.id, {
        grid_column: dropTarget.col,
        grid_row: dropTarget.row,
        col_span: activeWidget.col_span,
        row_span: activeWidget.row_span,
      })

      if (!ok) {
        setBlocks(previous)
      }
    }

    setActiveWidget(null)
    setDropTarget(null)
    setDropValid(false)
    gridRectRef.current = null
  }, [activeWidget, blocks, dropTarget, dropValid, onPersistLayout])

  const handleResize = useCallback(async (moduleId: string, colSpan: number, rowSpan: number) => {
    const target = blocks.find((block) => block.module.moduleId === moduleId)
    if (!target) return

    const previous = blocks
    const next = upsertLayout(blocks, moduleId, { col_span: colSpan, row_span: rowSpan })
    setBlocks(next)

    const ok = await onPersistLayout(moduleId, {
      grid_column: target.layout.grid_column,
      grid_row: target.layout.grid_row,
      col_span: colSpan,
      row_span: rowSpan,
    })

    if (!ok) {
      setBlocks(previous)
    }
  }, [blocks, onPersistLayout])

  const highlightedCells = useMemo(() => {
    if (!activeWidget || !dropTarget) return new Map<string, CellHighlight>()
    const cells = getCellsForPlacement(
      dropTarget.col,
      dropTarget.row,
      activeWidget.col_span,
      activeWidget.row_span
    )
    const highlight: CellHighlight = dropValid ? 'valid' : 'invalid'
    const map = new Map<string, CellHighlight>()
    for (const key of cells) map.set(key, highlight)
    return map
  }, [activeWidget, dropTarget, dropValid])

  const gridCells = useMemo(() => {
    if (!activeWidget) return []
    const cells: Array<{ col: number; row: number; highlight: CellHighlight }> = []
    for (let row = 1; row <= totalRows; row++) {
      for (let col = 1; col <= GRID_COLS; col++) {
        const key = `${col},${row}`
        cells.push({ col, row, highlight: highlightedCells.get(key) || 'none' })
      }
    }
    return cells
  }, [activeWidget, highlightedCells, totalRows])

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-[11px] text-muted-foreground flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          <span>
            {isEditMode
              ? 'Edit mode: drag module blocks and resize from the bottom-right corner.'
              : 'Select a module block to edit its internal widget layout.'}
          </span>
        </div>
        {isEditMode && (
          <span className="inline-flex items-center gap-1 text-foreground/80">
            <Move className="h-3.5 w-3.5" />
            Layout
          </span>
        )}
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragCancel={handleDragCancel}
        onDragEnd={() => { void handleDragEnd() }}
      >
        <div
          ref={gridRef}
          className="grid gap-3 relative"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${totalRows}, minmax(150px, auto))`,
          }}
        >
          {gridCells.map((cell) => (
            <GridCell
              key={`module-cell-${cell.col}-${cell.row}`}
              col={cell.col}
              row={cell.row}
              highlight={cell.highlight}
            />
          ))}

          {blocks.map((block) => {
            const widget = toWidget(block)
            const isSelected = activeModuleSlug === block.module.slug
            return (
              <WidgetWrapper
                key={block.module.moduleId}
                widget={widget}
                isEditMode={isEditMode}
                isBeingDragged={activeWidget?.id === widget.id}
                onEdit={() => onSelectModule(block.module.slug)}
                onDelete={() => {}}
                onResize={(widgetId, col, row) => {
                  void handleResize(widgetId, col, row)
                }}
                gridCellWidth={gridDimensions.cellWidth}
                gridRowHeight={gridDimensions.rowHeight}
                showActionControls={false}
                showTitleBar={false}
                showResizeHandle={isEditMode}
              >
                <div className={`h-full flex flex-col justify-between gap-3 rounded-lg border p-3 ${
                  isSelected
                    ? 'border-primary/45 bg-primary/5'
                    : 'border-border/60 bg-background/80'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-md border border-border/60 bg-background flex items-center justify-center shrink-0">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{block.module.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {block.module.description || 'Module block'}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`rounded-md border px-2 py-1 text-[10px] font-medium uppercase tracking-wide ${
                        isSelected
                          ? 'border-primary/40 text-primary bg-primary/10'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      Module
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {block.module.dashboardId ? 'Dashboard linked' : 'No dashboard linked'}
                    </span>
                    <Button
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 px-2 text-[11px] gap-1"
                      onClick={() => onSelectModule(block.module.slug)}
                    >
                      <Pencil className="h-3 w-3" />
                      {isSelected ? 'Editing' : 'Edit module'}
                    </Button>
                  </div>
                </div>
              </WidgetWrapper>
            )
          })}
        </div>

        <DragOverlay
          dropAnimation={{
            duration: 220,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {activeWidget ? (
            <motion.div
              className="rounded-xl border border-border/70 bg-card p-4"
              style={{
                width: gridDimensions.cellWidth * activeWidget.col_span + 12 * (activeWidget.col_span - 1),
                boxShadow: '0 12px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.08)',
              }}
            >
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium truncate">
                  {blocks.find((block) => block.module.moduleId === activeWidget.id)?.module.name || 'Module'}
                </p>
              </div>
            </motion.div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
