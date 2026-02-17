#!/usr/bin/env bash
# =============================================================================
# Backfill Script
#
# Runs the pipeline with a larger rolling window to backfill historical data.
#
# Usage:
#   ./scripts/backfill.sh 90        # Backfill last 90 days
#   ./scripts/backfill.sh 365       # Backfill last year
#
# WARNING: Large backfills will process significant data and incur BigQuery costs.
# =============================================================================

set -euo pipefail

DAYS="${1:-90}"

echo "=== Backfill: Rebuilding last $DAYS days ==="
echo ""
echo "WARNING: This will process a large amount of data."
read -p "Continue? (y/N) " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/run-local.sh" --run --vars="{\"rolling_window_days\":\"$DAYS\"}"

echo ""
echo "Backfill complete for last $DAYS days."
