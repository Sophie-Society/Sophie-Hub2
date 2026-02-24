'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { SessionProvider } from 'next-auth/react'
import { Hash, LayoutDashboard, Pencil, Plus, Trash2 } from 'lucide-react'
import { type NavSection } from '@/lib/navigation/config'
import { type PreviewModule } from '@/lib/views/module-nav'
import { SidebarContent } from '@/components/layout/sidebar'
import { PreviewProvider, usePreviewContext } from './preview-context'
import { PreviewModuleContent } from './preview-module-content'
import { ModuleBlockCanvas } from './module-block-canvas'
import type { PreviewSessionPayload } from '@/lib/views/preview-session'
import { sendToParent, listenFromParent } from '@/lib/views/preview-bridge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PreviewShellProps {
  session: PreviewSessionPayload
  modules: PreviewModule[]
  previewIdentity: {
    name: string
    roleLabel: string
  }
}

type SectionLink = {
  id: string
  title: string
  iconEmoji: string | null
}

const SECTION_ICON_OPTIONS = ['•', '📊', '📈', '💰', '🧭', '🗂️', '🧩', '✅', '🔥', '⭐', '📝', '📦']

// ---------------------------------------------------------------------------
// Shell Component (renders the full app experience)
// ---------------------------------------------------------------------------

function PreviewShellInner({ previewIdentity }: { previewIdentity: PreviewShellProps['previewIdentity'] }) {
  const {
    viewId,
    modules,
    activeModuleSlug,
    setActiveModule,
    isEditMode,
    setEditMode,
  } = usePreviewContext()
  const [moduleSectionsBySlug, setModuleSectionsBySlug] = useState<Record<string, SectionLink[]>>({})
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false)
  const [sectionDialogSaving, setSectionDialogSaving] = useState(false)
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [sectionTitleDraft, setSectionTitleDraft] = useState('')
  const [sectionIconDraft, setSectionIconDraft] = useState('•')
  const roleLabel = previewIdentity.roleLabel.toLowerCase()

  const selectedModule = useMemo(() => {
    if (!modules.length || !activeModuleSlug) return null
    return modules.find((module) => module.slug === activeModuleSlug) ?? null
  }, [modules, activeModuleSlug])

  const selectedModuleSections = useMemo(() => {
    if (!selectedModule) return []
    return moduleSectionsBySlug[selectedModule.slug] ?? []
  }, [selectedModule, moduleSectionsBySlug])

  const handleSectionsResolved = useCallback((moduleSlug: string, sections: SectionLink[]) => {
    setModuleSectionsBySlug((prev) => {
      const current = prev[moduleSlug] ?? []
      const currentSig = current.map((section) => `${section.id}:${section.title}:${section.iconEmoji ?? ''}`).join('|')
      const nextSig = sections.map((section) => `${section.id}:${section.title}:${section.iconEmoji ?? ''}`).join('|')
      if (currentSig === nextSig) return prev
      return {
        ...prev,
        [moduleSlug]: sections,
      }
    })
  }, [])

  const openCreateSectionDialog = useCallback(() => {
    if (!selectedModule?.dashboardId) {
      sendToParent({ type: 'previewError', message: 'Select a module with a dashboard before adding sections.' })
      return
    }
    setEditingSectionId(null)
    setSectionTitleDraft('')
    setSectionIconDraft('•')
    setSectionDialogOpen(true)
  }, [selectedModule])

  const openEditSectionDialog = useCallback((section: SectionLink) => {
    setEditingSectionId(section.id)
    setSectionTitleDraft(section.title)
    setSectionIconDraft(section.iconEmoji || '•')
    setSectionDialogOpen(true)
  }, [])

  const handleSaveSection = useCallback(async () => {
    if (!selectedModule?.dashboardId) return
    const trimmedTitle = sectionTitleDraft.trim()
    if (!trimmedTitle) return

    setSectionDialogSaving(true)
    try {
      if (editingSectionId) {
        const res = await fetch(`/api/admin/views/${viewId}/sections/${editingSectionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: trimmedTitle,
            icon_emoji: sectionIconDraft || null,
          }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          sendToParent({ type: 'previewError', message: err?.error?.message || 'Failed to update section.' })
          return
        }
      } else {
        const res = await fetch(`/api/admin/views/${viewId}/sections`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dashboardId: selectedModule.dashboardId,
            title: trimmedTitle,
            icon_emoji: sectionIconDraft || null,
          }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          sendToParent({ type: 'previewError', message: err?.error?.message || 'Failed to create section.' })
          return
        }
      }

      setSectionDialogOpen(false)
      sendToParent({ type: 'compositionSaved' })
      window.location.reload()
    } catch {
      sendToParent({ type: 'previewError', message: 'Failed to save section.' })
    } finally {
      setSectionDialogSaving(false)
    }
  }, [editingSectionId, sectionIconDraft, sectionTitleDraft, selectedModule, viewId])

  const handleDeleteSection = useCallback(async (sectionId: string) => {
    const confirmed = window.confirm('Delete this section and its widgets?')
    if (!confirmed) return

    try {
      const res = await fetch(`/api/admin/views/${viewId}/sections/${sectionId}`, {
        method: 'DELETE',
      })

      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({}))
        sendToParent({ type: 'previewError', message: err?.error?.message || 'Failed to delete section.' })
        return
      }

      sendToParent({ type: 'compositionSaved' })
      window.location.reload()
    } catch {
      sendToParent({ type: 'previewError', message: 'Failed to delete section.' })
    }
  }, [viewId])

  const reportActiveModule = useCallback((slug: string | null) => {
    if (!slug) {
      sendToParent({ type: 'activeModuleReport', moduleSlug: '', dashboardId: null })
      return
    }

    const mod = modules.find((m) => m.slug === slug)
    sendToParent({
      type: 'activeModuleReport',
      moduleSlug: slug,
      dashboardId: mod?.dashboardId || null,
    })
  }, [modules])

  // Bridge: notify parent that preview is ready, listen for commands
  useEffect(() => {
    sendToParent({ type: 'previewReady' })
    reportActiveModule(null)

    return listenFromParent((msg) => {
      if (msg.type === 'refreshRequested') {
        window.location.reload()
      } else if (msg.type === 'editModeChanged') {
        setEditMode(msg.enabled)
      } else if (msg.type === 'activeModuleChanged') {
        setActiveModule(msg.slug || null)
      }
    })
  }, [setEditMode, setActiveModule, reportActiveModule, activeModuleSlug, modules])

  // Keep parent in sync with explicit module selection state.
  useEffect(() => {
    reportActiveModule(activeModuleSlug)
  }, [activeModuleSlug, reportActiveModule])

  // Intercept sidebar module link clicks so they update context state
  // instead of triggering a Next.js navigation (which would lose the token)
  function handleSidebarClick(e: React.MouseEvent) {
    const link = (e.target as HTMLElement).closest('a')
    if (!link) return

    const rawHref = link.getAttribute('href')
    if (!rawHref) return

    const url = new URL(rawHref, window.location.origin)
    const href = (url.pathname || '/').replace(/\/+$/, '') || '/'
    const hash = url.hash

    if ((href === '/preview' || href === '/preview/dashboard') && hash === '#add-section') {
      e.preventDefault()
      e.stopPropagation()
      openCreateSectionDialog()
      return
    }

    if ((href === '/preview' || href === '/preview/dashboard') && hash.startsWith('#section-')) {
      e.preventDefault()
      e.stopPropagation()
      const sectionId = hash.replace('#section-', '')
      const el = document.getElementById(`preview-section-${sectionId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      return
    }

    if (href === '/preview' || href === '/preview/dashboard') {
      e.preventDefault()
      e.stopPropagation()
      setActiveModule(null)
      return
    }

    // Legacy fallback support if older hrefs still render.
    if (href === '/preview/action/add-section') {
      e.preventDefault()
      e.stopPropagation()
      openCreateSectionDialog()
      return
    }

    if (href.startsWith('/preview/section/')) {
      e.preventDefault()
      e.stopPropagation()
      const sectionId = href.replace('/preview/section/', '')
      const el = document.getElementById(`preview-section-${sectionId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      return
    }

    if (!href.startsWith('/preview/module/')) return

    e.preventDefault()
    e.stopPropagation()
    const slug = href.replace('/preview/module/', '')
    setActiveModule(slug)
  }

  // Build preview navigation:
  // - Dashboard is always first
  // - Section links appear only when a module is explicitly selected
  //   for module-internal editing.
  const navSections = useMemo<NavSection[]>(() => {
    const dashboardItems: NavSection['items'] = [
      {
        name: 'Dashboard',
        href: '/preview',
        icon: LayoutDashboard,
      },
    ]

    const editingItems: NavSection['items'] = selectedModuleSections.map((section) => ({
      name: section.title,
      href: `/preview#section-${section.id}`,
      icon: Hash,
    }))

    if (isEditMode && selectedModule) {
      editingItems.push({
        name: 'Add Section',
        href: '/preview#add-section',
        icon: Plus,
      })
    }

    const sections: NavSection[] = [{
      title: 'Overview',
      items: dashboardItems,
    }]

    if (selectedModule && editingItems.length > 0) {
      sections.push({
        title: selectedModule.name,
        items: editingItems,
      })
    }

    return sections
  }, [isEditMode, selectedModule, selectedModuleSections])

  // Find active module
  const activeModule = modules.find((m) => m.slug === activeModuleSlug)

  const handlePersistModuleLayout = useCallback(async (
    moduleId: string,
    layout: { grid_column: number; grid_row: number; col_span: number; row_span: number }
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/views/${viewId}/modules`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module_id: moduleId, layout }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        sendToParent({ type: 'previewError', message: err?.error?.message || 'Failed to save module layout.' })
        return false
      }

      sendToParent({ type: 'compositionSaved' })
      return true
    } catch {
      sendToParent({ type: 'previewError', message: 'Failed to save module layout.' })
      return false
    }
  }, [viewId])

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar — uses shared component with navOverride (HR-3) */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <aside
        className="hidden md:block fixed left-0 top-0 z-40 h-screen w-64 border-r border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        onClickCapture={handleSidebarClick}
      >
        <SidebarContent
          navOverride={navSections}
          hideUserControls={false}
          previewIdentity={previewIdentity}
          layoutId="previewNav"
          onNavigate={undefined}
        />
      </aside>

      {/* Main content area */}
      <main className="pl-0 md:pl-64">
        <div className="min-h-screen">
          {/* Subtle preview badge */}
          <div className="fixed right-4 top-3 z-30 rounded-full border border-border/60 bg-background/85 px-2.5 py-1 text-[10px] uppercase tracking-wide text-muted-foreground backdrop-blur">
            Preview as {roleLabel}
          </div>

          {/* Content */}
          <div className="p-6">
            {isEditMode && selectedModule && (
              <div className="mb-4 flex items-center justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={openCreateSectionDialog}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Section
                </Button>
              </div>
            )}

            {activeModule ? (
              <PreviewModuleContent module={activeModule} onSectionsResolved={handleSectionsResolved} />
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold">Dashboard</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    This is the base landing page for the selected audience.
                  </p>
                </div>

                {modules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-border">
                    <h3 className="text-sm font-medium text-muted-foreground">No modules assigned</h3>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Add modules from the builder toolbar to populate this view.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <ModuleBlockCanvas
                      modules={modules}
                      isEditMode={isEditMode}
                      activeModuleSlug={activeModuleSlug}
                      onSelectModule={setActiveModule}
                      onPersistLayout={handlePersistModuleLayout}
                    />
                    <div className="text-xs text-muted-foreground/70 mt-1">
                      Drag and resize module blocks in Edit mode. Select a block to edit its internal widget layout.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editingSectionId ? 'Edit Section' : 'Add Section'}</DialogTitle>
            <DialogDescription>
              Create or update sidebar sections for this view. Pick an icon and name to keep navigation clear.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="section-title">Section name</Label>
              <Input
                id="section-title"
                value={sectionTitleDraft}
                onChange={(event) => setSectionTitleDraft(event.target.value)}
                placeholder="e.g. Sales Overview"
              />
            </div>

            <div className="space-y-2">
              <Label>Section icon</Label>
              <div className="grid grid-cols-6 gap-2">
                {SECTION_ICON_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSectionIconDraft(emoji)}
                    className={`h-9 rounded-md border text-base transition-colors ${
                      sectionIconDraft === emoji
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-accent'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {selectedModuleSections.length > 0 && (
              <div className="space-y-2 rounded-md border border-border/60 p-3">
                <p className="text-xs font-medium text-muted-foreground">Current sections</p>
                <div className="space-y-1.5">
                  {selectedModuleSections.map((section) => (
                    <div key={section.id} className="flex items-center gap-2 rounded-md border border-border/50 px-2 py-1.5">
                      <span className="text-sm">{section.iconEmoji || '•'}</span>
                      <span className="flex-1 truncate text-sm">{section.title}</span>
                      <button
                        type="button"
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        onClick={() => openEditSectionDialog(section)}
                        title="Edit section"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => void handleDeleteSection(section.id)}
                        title="Delete section"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSectionDialogOpen(false)}
              disabled={sectionDialogSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSaveSection()}
              disabled={sectionDialogSaving || !sectionTitleDraft.trim()}
            >
              {sectionDialogSaving ? 'Saving...' : editingSectionId ? 'Save Section' : 'Create Section'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root Shell (wraps with providers)
// ---------------------------------------------------------------------------

export function PreviewShell({ session, modules, previewIdentity }: PreviewShellProps) {
  return (
    <SessionProvider>
      <PreviewProvider
        viewId={session.vid}
        subjectType={session.subjectType}
        targetId={session.targetId}
        resolvedRole={session.resolvedRole}
        dataMode={session.dataMode}
        modules={modules}
      >
        <PreviewShellInner previewIdentity={previewIdentity} />
      </PreviewProvider>
    </SessionProvider>
  )
}
