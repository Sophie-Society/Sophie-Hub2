# Sophie Society - BigQuery Reporting Pipeline

Dataform-based data pipeline that transforms raw BigQuery data (from Daton/Amazon APIs) into curated fact tables and pre-aggregated reporting rollups for Sophie Hub and Power BI.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌───────────┐
│  raw.*      │────▶│  curated.*   │────▶│  reporting.* │────▶│  Sophie   │
│  (Daton)    │     │  (canonical) │     │  (rollups)   │     │  Hub UI   │
└─────────────┘     └──────────────┘     └──────────────┘     └───────────┘
                           │                    │
                           ▼                    ▼
                    ┌──────────────┐     ┌──────────────┐
                    │  assertions  │     │  admin.*     │
                    │  (DQ checks) │     │  (freshness) │
                    └──────────────┘     └──────────────┘
```

### Datasets

| Dataset | Purpose | Managed By |
|---------|---------|------------|
| `raw` | Raw data from Daton/external sources | Daton (read-only for Dataform) |
| `curated` | Canonical fact + dimension tables | Dataform (this pipeline) |
| `reporting` | Pre-aggregated rollups | Dataform (this pipeline) |
| `admin` | Freshness tracking, query history | Dataform (this pipeline) |
| `dataform_assertions` | Data quality test results | Dataform (this pipeline) |

### Tables

**Curated (canonical fact tables):**
- `curated_sponsored_products` — SP advertising data
- `curated_sponsored_display` — SD advertising data
- `curated_sponsored_brands` — SB advertising data
- `curated_sales` — Selling Partner sales
- `curated_refunds` — Refund metrics
- `curated_match` — Campaign match type data
- `curated_inventory` — FBA inventory aging
- `curated_settlement` — Financial settlements
- `curated_sns_performance` — Subscribe & Save

**Dimensions:**
- `dim_clients` — Brand/client dimension
- `dim_products` — Product dimension
- `bridge_product_client` — Product-to-client bridge

**Rollups (reporting):**
- `rpt_brand_day` — Daily brand-level metrics (partition: report_date, cluster: brand_id, marketplace)
- `rpt_asin_day` — Daily ASIN-level metrics (partition: report_date, cluster: brand_id, asin, marketplace)
- `rpt_campaign_day` — Daily campaign-level metrics (partition: report_date, cluster: brand_id, campaign_id, marketplace)

**Admin:**
- `reporting_freshness` — Per-brand data freshness tracker
- `query_history` — View over INFORMATION_SCHEMA.JOBS

## Setup

### Prerequisites

1. **GCP Project** with BigQuery API enabled
2. **Node.js 18+** (for Dataform CLI)
3. **Dataform CLI**: `npm install -g @dataform/cli`
4. **gcloud CLI**: Authenticated with `gcloud auth application-default login`
5. **Terraform 1.5+** (for infrastructure provisioning)

### Step 1: Provision Infrastructure

```bash
cd infra
terraform init
terraform plan -var="project_id=YOUR_GCP_PROJECT_ID"
terraform apply -var="project_id=YOUR_GCP_PROJECT_ID"
```

This creates:
- 5 BigQuery datasets (raw, curated, reporting, admin, dataform_assertions)
- Service account `dataform-pipeline@` with minimal IAM roles
- (Optional) Dataform repository in GCP console

### Step 2: Configure Environment

```bash
export GOOGLE_CLOUD_PROJECT=your-gcp-project-id
```

### Step 3: Install Dependencies

```bash
cd dataform-pipeline
npm install
```

### Step 4: Compile (Dry Run)

```bash
dataform compile
# or
./scripts/run-local.sh
```

### Step 5: Run Pipeline

```bash
dataform run --default-database="$GOOGLE_CLOUD_PROJECT"
# or
./scripts/run-local.sh --run
```

### Step 6: Verify Tables

```bash
./scripts/verify-tables.sh
```

### Step 7: Backfill Historical Data

```bash
./scripts/backfill.sh 90   # Last 90 days
./scripts/backfill.sh 365  # Last year
```

## Incremental Strategy

All fact tables and rollups use **incremental** mode with a configurable rolling window:

- **Default window**: 7 days (rebuilds last 7 days on each run)
- **Override**: Set `rolling_window_days` in `dataform.json` vars or via CLI:
  ```bash
  dataform run --vars='{"rolling_window_days":"14"}'
  ```
- **Partition filter**: `updatePartitionFilter` ensures only recent partitions are scanned
- **Idempotent**: Re-running the same window produces identical results

### Why trailing window instead of pure append?

Late-arriving data from Amazon APIs can backfill 2-3 days after the fact. A 7-day window catches these late arrivals while keeping scan costs low.

## Scheduling

### Option A: Dataform Scheduled Execution (Recommended)

In the GCP Dataform console:

1. Go to your Dataform repository → **Release Configurations**
2. Create a release config pointing to your `main` branch
3. Go to **Workflow Configurations** → **Create**
4. Set schedule: `17 6 * * *` (daily at 6:17 AM UTC — offset from the hour to avoid contention)
5. Set service account to `dataform-pipeline@YOUR_PROJECT.iam.gserviceaccount.com`

### Option B: BigQuery Scheduled Queries (Alternative)

For teams not using Dataform in GCP console, create scheduled queries manually:

```sql
-- Schedule each rollup as a separate scheduled query
-- Set schedule to: Every day at 06:17 UTC
-- Use "WRITE_TRUNCATE" for dimensions, "MERGE" for facts

-- Example: rpt_brand_day (create as scheduled query in BQ console)
-- Paste the compiled SQL from dataform compile output
```

**Scheduling tips:**
- Schedule at `:17` or `:43` past the hour (avoids exact-hour contention)
- Run curated tables first, rollups second (or use Dataform DAG for ordering)
- Allow 30 minutes between curated and rollup runs if using scheduled queries

## Data Quality Assertions

| Assertion | What it checks |
|-----------|---------------|
| `assert_not_null_brand_id_brand_day` | brand_id is never NULL |
| `assert_not_null_report_date` | report_date is never NULL in any rollup |
| `assert_no_negative_spend` | Ad spend >= 0 |
| `assert_no_future_dates` | No report_date beyond tomorrow |
| `assert_data_freshness` | No brand > 3 days stale |
| `assert_unique_brand_day` | No duplicate (brand, marketplace, date) rows |

Run assertions only:
```bash
dataform run --tags=assertion
```

## Security

### Row-Level Security (RLS) via BigQuery

BigQuery supports RLS through **policy tags** and **authorized views**. Two approaches:

#### Approach 1: Authorized Views (Simpler)

Create views that filter by brand_id based on the querying user's allowed brands:

```sql
-- Create a brand access control table
CREATE TABLE admin.brand_access (
  user_email STRING,
  brand_id   STRING
);

-- Create authorized view
CREATE VIEW reporting.rpt_brand_day_secure AS
SELECT *
FROM reporting.rpt_brand_day
WHERE brand_id IN (
  SELECT brand_id
  FROM admin.brand_access
  WHERE user_email = SESSION_USER()
);

-- Grant access to the view, not the underlying table
-- In BigQuery Console: Dataset → Sharing → Authorize Views
```

#### Approach 2: Row-Level Access Policies (Enterprise)

Requires BigQuery Enterprise or Enterprise Plus:

```sql
-- Create a row access policy
CREATE ROW ACCESS POLICY brand_filter
ON reporting.rpt_brand_day
GRANT TO ("user:analyst@sophiesociety.com")
FILTER USING (brand_id IN ('brand_a', 'brand_b'));

-- Or dynamically via a lookup table:
CREATE ROW ACCESS POLICY brand_filter_dynamic
ON reporting.rpt_brand_day
GRANT TO ("allAuthenticatedUsers")
FILTER USING (
  brand_id IN (
    SELECT brand_id FROM admin.brand_access
    WHERE user_email = SESSION_USER()
  )
);
```

**Recommendation**: Start with **Authorized Views** — simpler, no Enterprise license needed, and sufficient for Sophie Hub's use case where the app server queries with a service account.

## File Structure

```
dataform-pipeline/
├── dataform.json              # Project config (warehouse, datasets, vars)
├── package.json               # Dataform CLI dependency
├── .gitignore
├── README.md                  # This file
│
├── includes/                  # Shared JS macros
│   ├── constants.js           # Dataset names, defaults
│   └── helpers.js             # SQL helper functions
│
├── definitions/
│   ├── raw_to_curated/        # Canonical fact tables (incremental)
│   │   ├── curated_sponsored_products.sqlx
│   │   ├── curated_sponsored_display.sqlx
│   │   ├── curated_sponsored_brands.sqlx
│   │   ├── curated_sales.sqlx
│   │   ├── curated_refunds.sqlx
│   │   ├── curated_match.sqlx
│   │   ├── curated_inventory.sqlx
│   │   ├── curated_settlement.sqlx
│   │   └── curated_sns_performance.sqlx
│   │
│   ├── dimensions/            # Dimension tables (full refresh)
│   │   ├── dim_clients.sqlx
│   │   ├── dim_products.sqlx
│   │   └── bridge_product_client.sqlx
│   │
│   ├── rollups/               # Reporting rollups (incremental)
│   │   ├── rpt_brand_day.sqlx
│   │   ├── rpt_asin_day.sqlx
│   │   └── rpt_campaign_day.sqlx
│   │
│   └── admin/                 # Pipeline metadata
│       ├── reporting_freshness.sqlx
│       ├── update_freshness.sqlx
│       └── query_history.sqlx
│
├── assertions/                # Data quality tests
│   ├── assert_not_null_keys.sqlx
│   ├── assert_not_null_report_date.sqlx
│   ├── assert_no_negative_spend.sqlx
│   ├── assert_no_future_dates.sqlx
│   ├── assert_freshness.sqlx
│   └── assert_unique_brand_day.sqlx
│
├── infra/                     # Terraform infrastructure
│   ├── main.tf                # Datasets, service accounts, IAM
│   └── variables.tf           # Configurable variables
│
└── scripts/                   # Helper scripts
    ├── run-local.sh           # Compile or run locally
    ├── verify-tables.sh       # Check tables exist with row counts
    └── backfill.sh            # Historical data backfill
```

## TODOs

The following items are marked with `TODO` in the SQL models and need to be resolved:

1. **Raw table names**: Several tables have `TBD` BigQuery sources in the sync config. Update `${ref("raw", "...")}` references once confirmed:
   - `curated_inventory` → actual inventory raw table
   - `curated_settlement` → actual settlement raw table
   - `curated_sns_performance` → actual SNS raw table
   - `dim_clients` → actual dim_clients raw table
   - `bridge_product_client` → actual bridge raw table

2. **Marketplace mapping**: Currently hardcoded to `'US'`. If multi-marketplace data exists in raw tables, add a marketplace column mapping.

3. **Pipeline run ID**: The freshness updater generates a UUID. If Dataform provides a run ID, pass it as a variable.

4. **Scheduled execution**: Configure in GCP Dataform console (see Scheduling section above).

5. **Authorized views for RLS**: Create once brand access control requirements are defined.

## Cost Estimates

With ~700 brands and daily runs:

| Operation | Estimated Monthly Cost |
|-----------|----------------------|
| Incremental curated (7-day window) | ~$2-5/month |
| Rollup rebuilds | ~$1-3/month |
| Assertions | ~$0.50/month |
| Storage (curated + reporting) | ~$1-2/month |
| **Total** | **~$5-10/month** |

Based on BigQuery on-demand pricing ($6.25/TB scanned). Actual costs depend on raw data volume.
