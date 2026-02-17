/**
 * Shared constants for the Sophie Society Dataform pipeline.
 *
 * Override rolling_window_days via dataform.json vars or CLI:
 *   dataform run --vars '{"rolling_window_days":"14"}'
 */

// Dataset names — change here to reconfigure all models at once
const DATASETS = {
  /** Raw Daton-ingested tables (per-client) */
  RAW: "sophiesociety_data",
  /** Unified per-report-type views (deduped across all clients) */
  PBI: "pbi",
  /** Canonical fact + dimension tables */
  CURATED: "curated",
  /** Pre-aggregated rollup tables */
  REPORTING: "reporting",
  /** Pipeline metadata */
  ADMIN: "admin",
};

// Default rolling window for incremental rollups (days to rebuild)
const DEFAULT_ROLLING_WINDOW_DAYS = 7;

// Common partition & cluster settings
const PARTITION_BY_REPORT_DATE = {
  field: "report_date",
  type: "DAY",
};

module.exports = {
  DATASETS,
  DEFAULT_ROLLING_WINDOW_DAYS,
  PARTITION_BY_REPORT_DATE,
};
