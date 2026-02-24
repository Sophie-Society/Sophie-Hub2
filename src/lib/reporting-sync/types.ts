/**
 * Reporting Sync Types — re-exported from canonical /types location.
 *
 * All shared types live in src/types/reporting.types.ts (per CLAUDE_CODE_RULES §3.2).
 * This file re-exports them so existing imports from './types' continue to work.
 */

export type {
  SyncStrategy,
  ReportingSyncConfig,
  TableSyncResult,
  SyncTableError,
  ReportingSyncSummary,
  ColumnDef,
  BigQueryRow,
  SyncConfigSummary,
} from '@/types/reporting.types'
