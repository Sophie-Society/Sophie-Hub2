/**
 * Reporting Sync Constants
 */

export const REPORTING_SYNC = {
  /** Rows per BigQuery page fetch */
  BQ_PAGE_SIZE: 10_000,

  /** Rows per Supabase upsert batch */
  UPSERT_BATCH_SIZE: 100,

  /** Log progress every N rows */
  PROGRESS_LOG_INTERVAL: 1000,

  /** Max duration for full sync before stopping (8.5 min - buffer for Vercel 10 min limit) */
  MAX_TOTAL_DURATION_MS: 8.5 * 60 * 1000,

  /** Days of overlap for incremental sync (catches late-arriving data) */
  INCREMENTAL_OVERLAP_DAYS: 3,
} as const
