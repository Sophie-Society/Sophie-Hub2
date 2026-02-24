'use client'

import { Suspense, useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Database,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Pause,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { SyncConfigSummary } from '@/types/reporting.types'

// Next.js App Router requires default export for page components
export default function ReportingSyncPage(): React.ReactElement {
  return (
    <Suspense>
      <ReportingSyncContent />
    </Suspense>
  )
}

// =============================================================================
// Main Content
// =============================================================================

function ReportingSyncContent() {
  const queryClient = useQueryClient()
  const [syncingTable, setSyncingTable] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['reporting-sync-config'],
    queryFn: async () => {
      const res = await fetch('/api/admin/reporting-sync/config')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message || 'Failed to load config')
      return json.data?.configs || json.configs || []
    },
  })

  const configs = (data || []) as SyncConfigSummary[]

  const factTables = configs.filter(c => c.sync_strategy === 'incremental')
  const dimTables = configs.filter(c => c.sync_strategy === 'full_refresh')
  const manualTables = configs.filter(c => c.sync_strategy === 'manual')

  const configuredCount = configs.filter(c => c.bigquery_source !== 'TBD').length
  const tbdCount = configs.filter(c => c.bigquery_source === 'TBD').length

  const handleSyncTable = useCallback(async (configId: string, tableName: string) => {
    setSyncingTable(configId)
    try {
      const res = await fetch('/api/admin/reporting-sync/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config_id: configId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message || 'Sync failed')

      // Unwrap standardized API envelope (apiSuccess wraps in { data })
      const result = json.data || json
      if (result.success) {
        toast.success(`Synced ${tableName}`, {
          description: `${result.rows_upserted} rows in ${Math.round(result.duration_ms / 1000)}s`,
        })
      } else {
        toast.error(`Sync failed for ${tableName}`, {
          description: result.errors?.[0]?.message || 'Unknown error',
        })
      }

      queryClient.invalidateQueries({ queryKey: ['reporting-sync-config'] })
    } catch (err: unknown) {
      toast.error('Sync failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setSyncingTable(null)
    }
  }, [queryClient])

  const handleSyncAll = useCallback(async () => {
    setSyncingAll(true)
    try {
      const res = await fetch('/api/admin/reporting-sync/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sync_all: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message || 'Sync failed')

      // Unwrap standardized API envelope (apiSuccess wraps in { data })
      const summary = json.data || json
      toast.success('Full sync complete', {
        description: `${summary.tables_succeeded}/${summary.total_tables} tables, ${summary.total_rows} rows in ${Math.round(summary.total_duration_ms / 1000)}s`,
      })

      queryClient.invalidateQueries({ queryKey: ['reporting-sync-config'] })
    } catch (err: unknown) {
      toast.error('Full sync failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setSyncingAll(false)
    }
  }, [queryClient])

  if (isLoading) {
    return (
      <>
        <PageHeader title="Reporting Sync" description="BigQuery to Supabase data pipeline" />
        <div className="p-4 md:p-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading sync configuration...
          </div>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title="Reporting Sync" description="BigQuery to Supabase data pipeline" />
        <div className="p-4 md:p-8">
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Failed to load sync configuration. Check your permissions.
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Reporting Sync" description="BigQuery to Supabase data pipeline">
        <Button
          onClick={handleSyncAll}
          disabled={syncingAll || syncingTable !== null}
          className="h-10 md:h-9 active:scale-[0.97]"
        >
          {syncingAll ? (
            <Loader2 className="h-4 w-4 animate-spin md:mr-1.5" />
          ) : (
            <Play className="h-4 w-4 md:mr-1.5" />
          )}
          <span className="hidden md:inline">
            {syncingAll ? 'Syncing All...' : 'Sync All'}
          </span>
        </Button>
      </PageHeader>

      <div className="p-4 md:p-8 space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4">
          <StatCard
            label="Total Tables"
            value={configs.length}
            icon={Database}
          />
          <StatCard
            label="Configured"
            value={configuredCount}
            icon={CheckCircle2}
            color="green"
          />
          <StatCard
            label="Awaiting Config"
            value={tbdCount}
            icon={AlertTriangle}
            color={tbdCount > 0 ? 'amber' : 'green'}
          />
          <StatCard
            label="Last Sync Errors"
            value={configs.filter(c => c.last_sync_error).length}
            icon={XCircle}
            color={configs.filter(c => c.last_sync_error).length > 0 ? 'red' : 'green'}
          />
        </div>

        {/* Fact Tables (Incremental) */}
        {factTables.length > 0 && (
          <TableGroup
            title="Fact Tables"
            description="Incremental sync by date (daily delta)"
            tables={factTables}
            onSync={handleSyncTable}
            syncingTable={syncingTable}
            syncingAll={syncingAll}
          />
        )}

        {/* Dimension Tables (Full Refresh) */}
        {dimTables.length > 0 && (
          <TableGroup
            title="Dimension Tables"
            description="Full refresh (truncate + reload)"
            tables={dimTables}
            onSync={handleSyncTable}
            syncingTable={syncingTable}
            syncingAll={syncingAll}
          />
        )}

        {/* Manual / Config Tables */}
        {manualTables.length > 0 && (
          <TableGroup
            title="Config Tables"
            description="One-time seed, manual updates only"
            tables={manualTables}
            onSync={handleSyncTable}
            syncingTable={syncingTable}
            syncingAll={syncingAll}
          />
        )}
      </div>
    </>
  )
}

// =============================================================================
// Sub-components
// =============================================================================

function StatCard({
  label,
  value,
  icon: Icon,
  color = 'default',
}: {
  label: string
  value: number
  icon: React.ElementType
  color?: 'default' | 'green' | 'amber' | 'red'
}) {
  const colorClasses = {
    default: 'text-foreground',
    green: 'text-green-600 dark:text-green-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <div className={cn('text-2xl font-semibold tabular-nums', colorClasses[color])}>
          {value}
        </div>
      </CardContent>
    </Card>
  )
}

function TableGroup({
  title,
  description,
  tables,
  onSync,
  syncingTable,
  syncingAll,
}: {
  title: string
  description: string
  tables: SyncConfigSummary[]
  onSync: (id: string, name: string) => void
  syncingTable: string | null
  syncingAll: boolean
}) {
  return (
    <div>
      <div className="mb-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-2">
        {tables.map(config => (
          <TableRow
            key={config.id}
            config={config}
            onSync={onSync}
            isSyncing={syncingTable === config.id || syncingAll}
          />
        ))}
      </div>
    </div>
  )
}

function TableRow({
  config,
  onSync,
  isSyncing,
}: {
  config: SyncConfigSummary
  onSync: (id: string, name: string) => void
  isSyncing: boolean
}) {
  const isTbd = config.bigquery_source === 'TBD'
  const hasError = !!config.last_sync_error
  const hasSynced = !!config.last_sync_at

  return (
    <Card className={cn(
      'transition-colors',
      hasError && 'border-red-200 dark:border-red-900/50',
      !config.sync_enabled && 'opacity-60',
    )}>
      <CardContent className="p-3 md:p-4">
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div className={cn(
            'h-2 w-2 rounded-full flex-shrink-0',
            isTbd ? 'bg-muted-foreground/30' :
            hasError ? 'bg-red-500' :
            hasSynced ? 'bg-green-500' :
            'bg-amber-500'
          )} />

          {/* Table info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">
                {config.table_name}
              </span>
              {isTbd && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                  Not Configured
                </Badge>
              )}
              {!config.sync_enabled && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  <Pause className="h-2.5 w-2.5 mr-0.5" />
                  Disabled
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
              <span className="truncate max-w-[200px]">
                {isTbd ? 'Awaiting BigQuery source' : config.bigquery_source}
              </span>
              {hasSynced && (
                <>
                  <span className="hidden md:inline">
                    {formatRelativeTime(config.last_sync_at!)}
                  </span>
                  <span className="tabular-nums">
                    {config.last_sync_rows.toLocaleString()} rows
                  </span>
                  {config.last_sync_duration_ms && (
                    <span className="hidden md:inline tabular-nums">
                      {formatDuration(config.last_sync_duration_ms)}
                    </span>
                  )}
                </>
              )}
            </div>
            {hasError && (
              <div className="mt-1 text-xs text-red-600 dark:text-red-400 truncate max-w-[400px]">
                {config.last_sync_error}
              </div>
            )}
          </div>

          {/* Sync button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 flex-shrink-0"
            onClick={() => onSync(config.id, config.table_name)}
            disabled={isSyncing || isTbd || !config.sync_enabled}
          >
            {isSyncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// =============================================================================
// Helpers
// =============================================================================

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${minutes}m ${remaining}s`
}
