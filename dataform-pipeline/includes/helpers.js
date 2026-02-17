/**
 * Shared SQL helper functions for the Sophie Society Dataform pipeline.
 */

const { DEFAULT_ROLLING_WINDOW_DAYS } = require("./constants");

/**
 * Returns a SQL expression for the rolling window start date.
 * Uses the Dataform variable `rolling_window_days` if set, otherwise the default.
 *
 * @param {object} ctx - Dataform compilation context (provides dataform.projectConfig.vars)
 * @param {string} dateColumn - The date column to compare against (default: "report_date")
 * @returns {string} SQL WHERE clause fragment
 */
function rollingWindowFilter(ctx, dateColumn = "report_date") {
  // Access the variable at compile time
  const days =
    (ctx && ctx.projectConfig && ctx.projectConfig.vars && ctx.projectConfig.vars.rolling_window_days) ||
    DEFAULT_ROLLING_WINDOW_DAYS;
  return `${dateColumn} >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)`;
}

/**
 * Generates a standard MERGE statement for incremental rollup tables.
 *
 * @param {string} targetTable - Fully qualified target table reference
 * @param {string} sourceQuery - The SELECT query for new data
 * @param {string[]} matchKeys - Columns to match on for MERGE
 * @param {string[]} allColumns - All columns in the target table
 * @param {string} dateColumn - Date column for partition pruning
 * @param {number} windowDays - How many trailing days to rebuild
 * @returns {string} Complete MERGE SQL statement
 */
function mergeIntoPartitioned(
  targetTable,
  sourceQuery,
  matchKeys,
  allColumns,
  dateColumn = "report_date",
  windowDays = 7
) {
  const matchCondition = matchKeys
    .map((k) => `T.${k} = S.${k}`)
    .join(" AND ");
  const updateSet = allColumns
    .filter((c) => !matchKeys.includes(c))
    .map((c) => `T.${c} = S.${c}`)
    .join(",\n      ");
  const insertCols = allColumns.join(", ");
  const insertVals = allColumns.map((c) => `S.${c}`).join(", ");

  return `
MERGE ${targetTable} T
USING (
  ${sourceQuery}
) S
ON ${matchCondition}
   AND T.${dateColumn} >= DATE_SUB(CURRENT_DATE(), INTERVAL ${windowDays} DAY)
WHEN MATCHED THEN
  UPDATE SET
      ${updateSet}
WHEN NOT MATCHED THEN
  INSERT (${insertCols})
  VALUES (${insertVals})
`;
}

/**
 * Generates a safe NUMERIC cast with COALESCE to 0.
 * @param {string} col - Column name
 * @param {string} alias - Optional alias
 * @returns {string} SQL expression
 */
function safeNumeric(col, alias) {
  const a = alias || col;
  return `COALESCE(SAFE_CAST(${col} AS NUMERIC), 0) AS ${a}`;
}

/**
 * Generates a safe INT64 cast with COALESCE to 0.
 */
function safeInt(col, alias) {
  const a = alias || col;
  return `COALESCE(SAFE_CAST(${col} AS INT64), 0) AS ${a}`;
}

/**
 * Generates a safe DATE cast.
 */
function safeDate(col, alias) {
  const a = alias || col;
  return `SAFE_CAST(${col} AS DATE) AS ${a}`;
}

module.exports = {
  rollingWindowFilter,
  mergeIntoPartitioned,
  safeNumeric,
  safeInt,
  safeDate,
};
