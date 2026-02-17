#!/usr/bin/env bash
# =============================================================================
# Local Dataform Development Runner
#
# Usage:
#   ./scripts/run-local.sh                    # Compile only (dry run)
#   ./scripts/run-local.sh --run              # Full run against BigQuery
#   ./scripts/run-local.sh --run --tags=rollup # Run only rollup-tagged models
#   ./scripts/run-local.sh --run --vars='{"rolling_window_days":"14"}'
#
# Prerequisites:
#   1. npm install -g @dataform/cli
#   2. gcloud auth application-default login
#   3. Set GOOGLE_CLOUD_PROJECT env var
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Default: compile only
ACTION="compile"
EXTRA_ARGS=""

for arg in "$@"; do
  case $arg in
    --run)
      ACTION="run"
      shift
      ;;
    *)
      EXTRA_ARGS="$EXTRA_ARGS $arg"
      ;;
  esac
done

echo "=== Sophie Society Dataform Pipeline ==="
echo "Action:  $ACTION"
echo "Project: ${GOOGLE_CLOUD_PROJECT:-not set}"
echo ""

if [ -z "${GOOGLE_CLOUD_PROJECT:-}" ]; then
  echo "ERROR: GOOGLE_CLOUD_PROJECT is not set."
  echo "  export GOOGLE_CLOUD_PROJECT=your-gcp-project-id"
  exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

if [ "$ACTION" = "compile" ]; then
  echo "Compiling Dataform project (dry run)..."
  dataform compile $EXTRA_ARGS
  echo ""
  echo "Compilation successful. Use --run to execute against BigQuery."
else
  echo "Running Dataform pipeline..."
  dataform run \
    --default-database="$GOOGLE_CLOUD_PROJECT" \
    $EXTRA_ARGS
  echo ""
  echo "Pipeline run complete."
fi
