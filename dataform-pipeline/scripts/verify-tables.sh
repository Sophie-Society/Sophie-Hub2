#!/usr/bin/env bash
# =============================================================================
# Verify Tables Exist After Pipeline Run
#
# Usage:
#   ./scripts/verify-tables.sh
#
# Checks that all expected tables exist in BigQuery and prints row counts.
# Requires: gcloud CLI, GOOGLE_CLOUD_PROJECT env var
# =============================================================================

set -euo pipefail

if [ -z "${GOOGLE_CLOUD_PROJECT:-}" ]; then
  echo "ERROR: GOOGLE_CLOUD_PROJECT is not set."
  exit 1
fi

PROJECT="$GOOGLE_CLOUD_PROJECT"

echo "=== Verifying BigQuery Tables in $PROJECT ==="
echo ""

TABLES=(
  # Curated
  "curated.curated_sponsored_products"
  "curated.curated_sponsored_display"
  "curated.curated_sponsored_brands"
  "curated.curated_sales"
  "curated.curated_refunds"
  "curated.curated_match"
  "curated.curated_inventory"
  "curated.curated_settlement"
  "curated.curated_sns_performance"
  "curated.dim_clients"
  "curated.dim_products"
  "curated.bridge_product_client"
  # Reporting
  "reporting.rpt_brand_day"
  "reporting.rpt_asin_day"
  "reporting.rpt_campaign_day"
  # Admin
  "admin.reporting_freshness"
)

PASS=0
FAIL=0

for TABLE in "${TABLES[@]}"; do
  RESULT=$(bq query --nouse_legacy_sql --format=csv \
    "SELECT COUNT(*) AS cnt FROM \`$PROJECT.$TABLE\` LIMIT 1" 2>/dev/null | tail -1)

  if [ $? -eq 0 ] && [ -n "$RESULT" ]; then
    printf "  %-50s %s rows\n" "$TABLE" "$RESULT"
    PASS=$((PASS + 1))
  else
    printf "  %-50s MISSING\n" "$TABLE"
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "Results: $PASS passed, $FAIL missing"

if [ $FAIL -gt 0 ]; then
  echo "Some tables are missing. Run the Dataform pipeline first."
  exit 1
fi

echo "All tables verified."
