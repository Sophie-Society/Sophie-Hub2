-- =============================================================================
-- Reporting Schema Migration 001: Align with actual BigQuery schemas
--
-- Run in Supabase SQL Editor AFTER the initial reporting-tables.sql.
-- Verified against BigQuery INFORMATION_SCHEMA on 2026-02-23.
-- =============================================================================

-- =============================================================================
-- 1. ADD MISSING COLUMNS
-- =============================================================================

-- rpt_sponsored_products: add ppc_units (exists in BQ, missing from SB)
ALTER TABLE rpt_sponsored_products ADD COLUMN IF NOT EXISTS ppc_units NUMERIC(12,2) DEFAULT 0;

-- rpt_sponsored_display: add ppc_units
ALTER TABLE rpt_sponsored_display ADD COLUMN IF NOT EXISTS ppc_units NUMERIC(12,2) DEFAULT 0;

-- rpt_sales: add session and B2B columns
ALTER TABLE rpt_sales ADD COLUMN IF NOT EXISTS sessions BIGINT DEFAULT 0;
ALTER TABLE rpt_sales ADD COLUMN IF NOT EXISTS sessions_b2b BIGINT DEFAULT 0;
ALTER TABLE rpt_sales ADD COLUMN IF NOT EXISTS units_ordered_b2b BIGINT DEFAULT 0;
ALTER TABLE rpt_sales ADD COLUMN IF NOT EXISTS ordered_product_sales_b2b NUMERIC(12,2) DEFAULT 0;
ALTER TABLE rpt_sales ADD COLUMN IF NOT EXISTS total_order_items_b2b BIGINT DEFAULT 0;

-- rpt_match: add match analysis columns
ALTER TABLE rpt_match ADD COLUMN IF NOT EXISTS match_type TEXT;
ALTER TABLE rpt_match ADD COLUMN IF NOT EXISTS match_group TEXT;
ALTER TABLE rpt_match ADD COLUMN IF NOT EXISTS match_subgroup TEXT;

-- rpt_match_v2: add match analysis columns
ALTER TABLE rpt_match_v2 ADD COLUMN IF NOT EXISTS match_type TEXT;
ALTER TABLE rpt_match_v2 ADD COLUMN IF NOT EXISTS match_group TEXT;
ALTER TABLE rpt_match_v2 ADD COLUMN IF NOT EXISTS match_subgroup TEXT;

-- rpt_sns_performance: add metric columns
ALTER TABLE rpt_sns_performance ADD COLUMN IF NOT EXISTS selling_partner_id TEXT;
ALTER TABLE rpt_sns_performance ADD COLUMN IF NOT EXISTS shipped_subscription_units BIGINT DEFAULT 0;
ALTER TABLE rpt_sns_performance ADD COLUMN IF NOT EXISTS total_subscriptions_revenue NUMERIC(12,2) DEFAULT 0;
ALTER TABLE rpt_sns_performance ADD COLUMN IF NOT EXISTS revenue_penetration NUMERIC(8,4);
ALTER TABLE rpt_sns_performance ADD COLUMN IF NOT EXISTS share_of_coupon_subscriptions NUMERIC(8,4);

-- rpt_sns_forecast: add forecast metric columns
ALTER TABLE rpt_sns_forecast ADD COLUMN IF NOT EXISTS selling_partner_id TEXT;
ALTER TABLE rpt_sns_forecast ADD COLUMN IF NOT EXISTS next_30d_revenue NUMERIC(12,2) DEFAULT 0;
ALTER TABLE rpt_sns_forecast ADD COLUMN IF NOT EXISTS next_60d_revenue NUMERIC(12,2) DEFAULT 0;
ALTER TABLE rpt_sns_forecast ADD COLUMN IF NOT EXISTS next_90d_revenue NUMERIC(12,2) DEFAULT 0;
ALTER TABLE rpt_sns_forecast ADD COLUMN IF NOT EXISTS next_30d_units BIGINT DEFAULT 0;
ALTER TABLE rpt_sns_forecast ADD COLUMN IF NOT EXISTS next_60d_units BIGINT DEFAULT 0;
ALTER TABLE rpt_sns_forecast ADD COLUMN IF NOT EXISTS next_90d_units BIGINT DEFAULT 0;

-- rpt_dim_products: add product_name and product_client_key
ALTER TABLE rpt_dim_products ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE rpt_dim_products ADD COLUMN IF NOT EXISTS product_client_key TEXT;

-- rpt_settlement: add many columns that exist in BQ but were missing from SB
ALTER TABLE rpt_settlement ADD COLUMN IF NOT EXISTS selling_partner_id TEXT;
ALTER TABLE rpt_settlement ADD COLUMN IF NOT EXISTS marketplace_id TEXT;
ALTER TABLE rpt_settlement ADD COLUMN IF NOT EXISTS marketplace_name TEXT;
ALTER TABLE rpt_settlement ADD COLUMN IF NOT EXISTS marketplace_name_report TEXT;
ALTER TABLE rpt_settlement ADD COLUMN IF NOT EXISTS settlement_id TEXT;
ALTER TABLE rpt_settlement ADD COLUMN IF NOT EXISTS settlement_start_date TEXT;
ALTER TABLE rpt_settlement ADD COLUMN IF NOT EXISTS settlement_end_date TEXT;
ALTER TABLE rpt_settlement ADD COLUMN IF NOT EXISTS deposit_date TEXT;
ALTER TABLE rpt_settlement ADD COLUMN IF NOT EXISTS total_amount TEXT;
ALTER TABLE rpt_settlement ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE rpt_settlement ADD COLUMN IF NOT EXISTS transaction_type TEXT;
ALTER TABLE rpt_settlement ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE rpt_settlement ADD COLUMN IF NOT EXISTS merchant_order_id TEXT;
ALTER TABLE rpt_settlement ADD COLUMN IF NOT EXISTS adjustment_id TEXT;
ALTER TABLE rpt_settlement ADD COLUMN IF NOT EXISTS shipment_id TEXT;
ALTER TABLE rpt_settlement ADD COLUMN IF NOT EXISTS fulfillment_id TEXT;
ALTER TABLE rpt_settlement ADD COLUMN IF NOT EXISTS posted_date_time TEXT;
ALTER TABLE rpt_settlement ADD COLUMN IF NOT EXISTS order_item_code TEXT;
ALTER TABLE rpt_settlement ADD COLUMN IF NOT EXISTS merchant_order_item_id TEXT;
ALTER TABLE rpt_settlement ADD COLUMN IF NOT EXISTS merchant_adjustment_item_id TEXT;
ALTER TABLE rpt_settlement ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE rpt_settlement ADD COLUMN IF NOT EXISTS quantity_purchased BIGINT;
ALTER TABLE rpt_settlement ADD COLUMN IF NOT EXISTS promotion_id TEXT;

-- =============================================================================
-- 2. FIX COLUMN TYPES (tables should be empty — safe to alter)
-- =============================================================================

-- rpt_settlement: report dates are TIMESTAMP in BQ, not DATE
ALTER TABLE rpt_settlement ALTER COLUMN report_start_date TYPE TIMESTAMPTZ
  USING report_start_date::TIMESTAMPTZ;
ALTER TABLE rpt_settlement ALTER COLUMN report_end_date TYPE TIMESTAMPTZ
  USING report_end_date::TIMESTAMPTZ;

-- rpt_settlement: daton_batch_runtime is NUMERIC in BQ, not TIMESTAMPTZ
ALTER TABLE rpt_settlement ALTER COLUMN daton_batch_runtime TYPE TEXT
  USING daton_batch_runtime::TEXT;

-- rpt_dim_clients: squad is INT64 in BQ, match is BOOL in BQ
ALTER TABLE rpt_dim_clients ALTER COLUMN squad TYPE INT
  USING NULLIF(squad, '')::INT;
ALTER TABLE rpt_dim_clients ALTER COLUMN match TYPE BOOLEAN
  USING CASE
    WHEN match IN ('true', '1', 'yes') THEN true
    WHEN match IN ('false', '0', 'no') THEN false
    ELSE NULL
  END;

-- =============================================================================
-- 3. FIX UNIQUE CONSTRAINTS
-- =============================================================================

-- rpt_sponsored_brands: BQ uses client_id (not client_name)
-- Drop existing unique constraint (auto-generated name)
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'rpt_sponsored_brands'::regclass AND contype = 'u'
  LOOP
    EXECUTE 'ALTER TABLE rpt_sponsored_brands DROP CONSTRAINT ' || r.conname;
  END LOOP;
END $$;
ALTER TABLE rpt_sponsored_brands
  ADD CONSTRAINT rpt_sponsored_brands_unique
  UNIQUE (client_id, date, campaign_id, asin);

-- rpt_settlement: subcategory_id doesn't exist in BQ, replace with columns that do
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'rpt_settlement'::regclass AND contype = 'u'
  LOOP
    EXECUTE 'ALTER TABLE rpt_settlement DROP CONSTRAINT ' || r.conname;
  END LOOP;
END $$;
ALTER TABLE rpt_settlement
  ADD CONSTRAINT rpt_settlement_unique
  UNIQUE NULLS NOT DISTINCT (client_name, settlement_id, posted_date, order_id, amount_type, amount_description);

-- =============================================================================
-- 4. UPDATE SYNC CONFIG
-- =============================================================================

-- Fix match table BQ source name (was pbi_match_v2_materialized, actual is pbi_match_unified_materialized_v2)
UPDATE rpt_sync_config
SET bigquery_source = 'pbi_match_unified_materialized_v2'
WHERE table_name IN ('rpt_match', 'rpt_match_v2');

-- Fix sponsored_brands unique key (uses client_id, not client_name)
UPDATE rpt_sync_config
SET unique_key_columns = ARRAY['client_id', 'date', 'campaign_id', 'asin']
WHERE table_name = 'rpt_sponsored_brands';

-- Fix settlement unique key (subcategory_id doesn't exist in BQ)
UPDATE rpt_sync_config
SET unique_key_columns = ARRAY['client_name', 'settlement_id', 'posted_date', 'order_id', 'amount_type', 'amount_description']
WHERE table_name = 'rpt_settlement';

-- =============================================================================
-- 5. ADD INDEXES ON NEW COLUMNS
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_rpt_dim_prod_pck ON rpt_dim_products (product_client_key);
CREATE INDEX IF NOT EXISTS idx_rpt_settle_settlement ON rpt_settlement (settlement_id);
CREATE INDEX IF NOT EXISTS idx_rpt_settle_order ON rpt_settlement (order_id);
