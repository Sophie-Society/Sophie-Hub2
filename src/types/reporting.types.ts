/**
 * Reporting Sync Types
 *
 * Type definitions for the BigQuery → Supabase reporting sync system.
 * Shared across API routes, sync engine, and admin UI.
 */

// =============================================================================
// Sync Configuration (mirrors rpt_sync_config table)
// =============================================================================

export type SyncStrategy = 'incremental' | 'full_refresh' | 'manual'

export interface ReportingSyncConfig {
  id: string
  table_name: string
  bigquery_source: string
  sync_strategy: SyncStrategy
  date_field: string | null
  unique_key_columns: string[]
  column_mapping: Record<string, string>
  last_sync_at: string | null
  last_sync_rows: number
  last_sync_duration_ms: number | null
  last_sync_error: string | null
  sync_enabled: boolean
  created_at: string
  updated_at: string
}

// =============================================================================
// Sync Progress & Results
// =============================================================================

export interface TableSyncResult {
  table_name: string
  success: boolean
  rows_fetched: number
  rows_upserted: number
  rows_deleted: number
  errors: SyncTableError[]
  duration_ms: number
  skipped_reason?: string
}

export interface SyncTableError {
  message: string
  row_index?: number
  severity: 'warning' | 'error'
}

export interface ReportingSyncSummary {
  started_at: string
  completed_at: string
  total_tables: number
  tables_succeeded: number
  tables_failed: number
  tables_skipped: number
  total_rows: number
  total_duration_ms: number
  results: TableSyncResult[]
}

// =============================================================================
// Column Mapping
// =============================================================================

export interface ColumnDef {
  /** BigQuery column name */
  bq: string
  /** Supabase column name */
  sb: string
  /** Optional type cast (e.g., 'numeric', 'date', 'bigint') */
  type?: 'text' | 'numeric' | 'bigint' | 'date' | 'timestamptz' | 'boolean' | 'int'
}

// =============================================================================
// BigQuery Row (generic record from query results)
// =============================================================================

export type BigQueryRow = Record<string, unknown>

// =============================================================================
// Admin UI Types
// =============================================================================

/** Slim config shape used by the admin reporting sync page */
export interface SyncConfigSummary {
  id: string
  table_name: string
  bigquery_source: string
  sync_strategy: string
  date_field: string | null
  unique_key_columns: string[]
  last_sync_at: string | null
  last_sync_rows: number
  last_sync_duration_ms: number | null
  last_sync_error: string | null
  sync_enabled: boolean
}
