/**
 * Reporting Sync Engine
 *
 * Pulls data from BigQuery reporting views and materializes them
 * into Supabase reporting tables (rpt_*). Supports incremental
 * sync (date-based delta) and full refresh strategies.
 *
 * Separate from the main SyncEngine (which handles Google Sheets → entities).
 */

import { BigQuery } from '@google-cloud/bigquery'
import { getAdminClient } from '@/lib/supabase/admin'
import { createLogger } from '@/lib/logger'
import { BIGQUERY } from '@/lib/constants'
import { REPORTING_SYNC } from './constants'
import { transformRow } from './column-mappings'
import type {
  ReportingSyncConfig,
  TableSyncResult,
  ReportingSyncSummary,
  SyncTableError,
  BigQueryRow,
} from './types'

const log = createLogger('reporting-sync')

// =============================================================================
// Reporting Sync Engine
// =============================================================================

export class ReportingSyncEngine {
  private supabase = getAdminClient()
  private bigquery = new BigQuery({ projectId: BIGQUERY.PROJECT_ID })

  /**
   * Sync all enabled tables. Returns a summary of results.
   * Processes dimension tables first, then fact tables, respecting
   * foreign key dependencies.
   */
  async syncAll(triggeredBy?: string): Promise<ReportingSyncSummary> {
    const startTime = Date.now()
    const startedAt = new Date().toISOString()

    log.info('Starting full reporting sync', { triggeredBy })

    // Full row needed: sync engine reads all config fields (strategy, date_field, unique_keys, etc.)
    const { data: configs, error } = await this.supabase
      .from('rpt_sync_config')
      .select('*')
      .eq('sync_enabled', true)
      .neq('bigquery_source', 'TBD')
      .order('sync_strategy', { ascending: true }) // full_refresh first, then incremental

    if (error) {
      log.error('Failed to load sync configs', { error: error.message })
      return {
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        total_tables: 0,
        tables_succeeded: 0,
        tables_failed: 1,
        tables_skipped: 0,
        total_rows: 0,
        total_duration_ms: Date.now() - startTime,
        results: [{
          table_name: 'rpt_sync_config',
          success: false,
          rows_fetched: 0,
          rows_upserted: 0,
          rows_deleted: 0,
          errors: [{ message: `Failed to load configs: ${error.message}`, severity: 'error' }],
          duration_ms: 0,
        }],
      }
    }

    const results: TableSyncResult[] = []
    let totalRows = 0

    for (const config of configs as ReportingSyncConfig[]) {
      // Timeout guard: stop if we're approaching Vercel's limit
      const elapsed = Date.now() - startTime
      if (elapsed > REPORTING_SYNC.MAX_TOTAL_DURATION_MS) {
        log.warn('Approaching timeout limit, stopping sync', {
          elapsed,
          tablesCompleted: results.length,
          tablesRemaining: configs.length - results.length,
        })
        // Mark remaining tables as skipped
        const remaining = configs.slice(results.length) as ReportingSyncConfig[]
        for (const r of remaining) {
          results.push({
            table_name: r.table_name,
            success: false,
            rows_fetched: 0,
            rows_upserted: 0,
            rows_deleted: 0,
            errors: [],
            duration_ms: 0,
            skipped_reason: 'Timeout: sync will continue on next cron invocation',
          })
        }
        break
      }

      const result = await this.syncTable(config)
      results.push(result)
      totalRows += result.rows_upserted
    }

    const summary: ReportingSyncSummary = {
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      total_tables: configs.length,
      tables_succeeded: results.filter(r => r.success).length,
      tables_failed: results.filter(r => !r.success && !r.skipped_reason).length,
      tables_skipped: results.filter(r => !!r.skipped_reason).length,
      total_rows: totalRows,
      total_duration_ms: Date.now() - startTime,
      results,
    }

    log.info('Reporting sync complete', {
      tables: summary.total_tables,
      succeeded: summary.tables_succeeded,
      failed: summary.tables_failed,
      totalRows,
      durationMs: summary.total_duration_ms,
    })

    return summary
  }

  /**
   * Sync a single table by config ID.
   */
  async syncTableById(configId: string): Promise<TableSyncResult> {
    // Full row needed: all config fields required to execute sync
    const { data: config, error } = await this.supabase
      .from('rpt_sync_config')
      .select('*')
      .eq('id', configId)
      .single()

    if (error || !config) {
      return {
        table_name: 'unknown',
        success: false,
        rows_fetched: 0,
        rows_upserted: 0,
        rows_deleted: 0,
        errors: [{ message: `Config not found: ${configId}`, severity: 'error' }],
        duration_ms: 0,
      }
    }

    return this.syncTable(config as ReportingSyncConfig)
  }

  /**
   * Sync a single table using its configuration.
   */
  async syncTable(config: ReportingSyncConfig): Promise<TableSyncResult> {
    const startTime = Date.now()
    const errors: SyncTableError[] = []

    log.info(`Syncing ${config.table_name}`, {
      strategy: config.sync_strategy,
      source: config.bigquery_source,
    })

    // Mark sync as started
    const { error: startError } = await this.supabase
      .from('rpt_sync_config')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', config.id)

    if (startError) {
      log.warn(`Failed to mark sync start for ${config.table_name}`, { err: startError.message })
    }

    try {
      if (config.bigquery_source === 'TBD') {
        return {
          table_name: config.table_name,
          success: false,
          rows_fetched: 0,
          rows_upserted: 0,
          rows_deleted: 0,
          errors: [{ message: 'BigQuery source not configured (TBD)', severity: 'warning' }],
          duration_ms: 0,
          skipped_reason: 'BigQuery source not yet configured',
        }
      }

      let result: TableSyncResult

      switch (config.sync_strategy) {
        case 'incremental':
          result = await this.syncIncremental(config, errors)
          break
        case 'full_refresh':
          result = await this.syncFullRefresh(config, errors)
          break
        default:
          result = {
            table_name: config.table_name,
            success: false,
            rows_fetched: 0,
            rows_upserted: 0,
            rows_deleted: 0,
            errors: [{ message: `Unknown strategy: ${config.sync_strategy}`, severity: 'error' }],
            duration_ms: 0,
            skipped_reason: 'Manual sync only',
          }
      }

      // Update config with results
      const { error: updateError } = await this.supabase
        .from('rpt_sync_config')
        .update({
          last_sync_rows: result.rows_upserted,
          last_sync_duration_ms: result.duration_ms,
          last_sync_error: result.success ? null : result.errors[0]?.message || 'Unknown error',
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.id)

      if (updateError) {
        log.warn(`Failed to update sync config for ${config.table_name}`, { err: updateError.message })
      }

      return result
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      log.error(`Sync failed for ${config.table_name}`, { err: message })

      const { error: errorUpdateError } = await this.supabase
        .from('rpt_sync_config')
        .update({
          last_sync_error: message,
          last_sync_duration_ms: Date.now() - startTime,
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.id)

      if (errorUpdateError) {
        log.warn(`Failed to record sync error for ${config.table_name}`, { err: errorUpdateError.message })
      }

      return {
        table_name: config.table_name,
        success: false,
        rows_fetched: 0,
        rows_upserted: 0,
        rows_deleted: 0,
        errors: [{ message, severity: 'error' }],
        duration_ms: Date.now() - startTime,
      }
    }
  }

  // ===========================================================================
  // Sync Strategies
  // ===========================================================================

  /**
   * Incremental sync: fetch rows newer than last sync date.
   * On first run (no last_sync_at), fetches all data.
   */
  private async syncIncremental(
    config: ReportingSyncConfig,
    errors: SyncTableError[]
  ): Promise<TableSyncResult> {
    const startTime = Date.now()
    const dateField = config.date_field || 'date'

    // Build query with optional date filter
    let query = `SELECT * FROM \`${BIGQUERY.PROJECT_ID}.${BIGQUERY.DATASET}.${config.bigquery_source}\``

    const params: Record<string, string> = {}

    if (config.last_sync_at) {
      // Fetch data from N days before last sync (overlap for late-arriving data)
      const overlapDate = new Date(config.last_sync_at)
      overlapDate.setDate(overlapDate.getDate() - REPORTING_SYNC.INCREMENTAL_OVERLAP_DAYS)
      const dateStr = overlapDate.toISOString().split('T')[0]

      query += ` WHERE ${dateField} >= @lastSyncDate`
      params.lastSyncDate = dateStr

      log.info(`Incremental sync from ${dateStr}`, { table: config.table_name })
    } else {
      log.info('First sync - fetching all data', { table: config.table_name })
    }

    query += ` ORDER BY ${dateField} ASC`

    return this.fetchAndUpsert(config, query, params, errors, startTime)
  }

  /**
   * Full refresh: delete all existing data, then insert fresh from BigQuery.
   */
  private async syncFullRefresh(
    config: ReportingSyncConfig,
    errors: SyncTableError[]
  ): Promise<TableSyncResult> {
    const startTime = Date.now()

    const query = `SELECT * FROM \`${BIGQUERY.PROJECT_ID}.${BIGQUERY.DATASET}.${config.bigquery_source}\``

    log.info('Full refresh - fetching all data', { table: config.table_name })

    // Delete existing data first
    const { error: deleteError } = await this.supabase
      .from(config.table_name)
      .delete()
      .neq('id' in config.unique_key_columns ? 'id' : config.unique_key_columns[0], '__nonexistent__')
      // Delete all rows: Supabase requires a filter, so we use a condition that matches everything

    if (deleteError) {
      // If delete fails (e.g., table has no 'id'), try a different approach
      log.warn(`Delete with filter failed for ${config.table_name}, trying RPC`, { error: deleteError.message })
    }

    return this.fetchAndUpsert(config, query, {}, errors, startTime)
  }

  // ===========================================================================
  // Core Data Pipeline
  // ===========================================================================

  /**
   * Execute a BigQuery query and upsert results into Supabase.
   * Handles pagination and batching.
   */
  private async fetchAndUpsert(
    config: ReportingSyncConfig,
    query: string,
    params: Record<string, string>,
    errors: SyncTableError[],
    startTime: number
  ): Promise<TableSyncResult> {
    let rowsFetched = 0
    let rowsUpserted = 0

    try {
      // Execute BigQuery query
      const [job] = await this.bigquery.createQueryJob({
        query,
        params,
        labels: { source: 'sophie-hub-reporting-sync', table: config.table_name },
      })

      // Get results with auto-pagination
      const [rows] = await job.getQueryResults({
        maxResults: REPORTING_SYNC.BQ_PAGE_SIZE,
        autoPaginate: true,
      })

      rowsFetched = rows.length
      log.info(`Fetched ${rowsFetched} rows from BigQuery`, { table: config.table_name })

      if (rowsFetched === 0) {
        return {
          table_name: config.table_name,
          success: true,
          rows_fetched: 0,
          rows_upserted: 0,
          rows_deleted: 0,
          errors,
          duration_ms: Date.now() - startTime,
        }
      }

      // Transform and upsert in batches
      rowsUpserted = await this.upsertInBatches(
        config,
        rows as BigQueryRow[],
        errors
      )

      return {
        table_name: config.table_name,
        success: true,
        rows_fetched: rowsFetched,
        rows_upserted: rowsUpserted,
        rows_deleted: 0,
        errors,
        duration_ms: Date.now() - startTime,
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push({ message, severity: 'error' })

      return {
        table_name: config.table_name,
        success: false,
        rows_fetched: rowsFetched,
        rows_upserted: rowsUpserted,
        rows_deleted: 0,
        errors,
        duration_ms: Date.now() - startTime,
      }
    }
  }

  /**
   * Transform BigQuery rows and upsert them into Supabase in batches.
   */
  private async upsertInBatches(
    config: ReportingSyncConfig,
    rows: BigQueryRow[],
    errors: SyncTableError[]
  ): Promise<number> {
    let upserted = 0
    const batchSize = REPORTING_SYNC.UPSERT_BATCH_SIZE

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)

      // Transform each row using column mappings
      const records = batch.map((row, idx) => {
        try {
          return transformRow(config.table_name, row)
        } catch (err: unknown) {
          errors.push({
            message: `Transform error at row ${i + idx}: ${err instanceof Error ? err.message : String(err)}`,
            row_index: i + idx,
            severity: 'warning',
          })
          return null
        }
      }).filter((r): r is Record<string, unknown> => r !== null)

      if (records.length === 0) continue

      // Build conflict columns string for upsert
      const conflictColumns = config.unique_key_columns.join(',')

      const { error: upsertError } = await this.supabase
        .from(config.table_name)
        .upsert(records, {
          onConflict: conflictColumns,
          ignoreDuplicates: false,
        })

      if (upsertError) {
        errors.push({
          message: `Upsert error at batch ${Math.floor(i / batchSize)}: ${upsertError.message}`,
          severity: 'error',
        })
        log.error(`Upsert failed for ${config.table_name}`, {
          batch: Math.floor(i / batchSize),
          error: upsertError.message,
        })
      } else {
        upserted += records.length
      }

      // Progress logging
      if ((i + batchSize) % REPORTING_SYNC.PROGRESS_LOG_INTERVAL === 0 || i + batchSize >= rows.length) {
        log.info(`Progress: ${Math.min(i + batchSize, rows.length)}/${rows.length} rows`, {
          table: config.table_name,
          upserted,
        })
      }
    }

    return upserted
  }
}

// =============================================================================
// Singleton
// =============================================================================

let _engine: ReportingSyncEngine | null = null

export function getReportingSyncEngine(): ReportingSyncEngine {
  if (!_engine) {
    _engine = new ReportingSyncEngine()
  }
  return _engine
}
