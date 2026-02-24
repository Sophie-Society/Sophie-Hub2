-- =============================================================================
-- Reporting Tables Schema
--
-- Materializes the Power BI data model in Supabase for local querying.
-- All tables prefixed with rpt_ to distinguish from operational tables.
--
-- Run in Supabase SQL Editor or as a migration.
-- =============================================================================

-- =============================================================================
-- 0. SYNC CONFIGURATION TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS rpt_sync_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT UNIQUE NOT NULL,
  bigquery_source TEXT NOT NULL,
  sync_strategy TEXT NOT NULL CHECK (sync_strategy IN ('incremental', 'full_refresh', 'manual')),
  date_field TEXT,
  unique_key_columns TEXT[] NOT NULL,
  column_mapping JSONB DEFAULT '{}',
  last_sync_at TIMESTAMPTZ,
  last_sync_rows BIGINT DEFAULT 0,
  last_sync_duration_ms BIGINT,
  last_sync_error TEXT,
  sync_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE rpt_sync_config IS 'Configuration for BigQuery → Supabase reporting sync per table';
COMMENT ON COLUMN rpt_sync_config.sync_strategy IS 'incremental = date-based delta, full_refresh = truncate+insert, manual = seed once';
COMMENT ON COLUMN rpt_sync_config.date_field IS 'Column used for incremental WHERE filter (e.g. date, snapshot_date)';
COMMENT ON COLUMN rpt_sync_config.unique_key_columns IS 'Columns for UPSERT ON CONFLICT';
COMMENT ON COLUMN rpt_sync_config.column_mapping IS 'Optional BQ→Supabase column name overrides as JSONB';

-- =============================================================================
-- 1. FACT TABLES (incremental sync by date)
-- =============================================================================

-- 1.1 Sponsored Products
CREATE TABLE IF NOT EXISTS rpt_sponsored_products (
  id BIGSERIAL PRIMARY KEY,
  ad_id TEXT,
  asin TEXT,
  campaign_type TEXT,
  campaign_id TEXT,
  campaign_name TEXT,
  clicks BIGINT DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  spend NUMERIC(12,2) DEFAULT 0,
  sales NUMERIC(12,2) DEFAULT 0,
  orders BIGINT DEFAULT 0,
  acos NUMERIC(8,4),
  client_name TEXT,
  date DATE NOT NULL,
  product_client_key TEXT,
  request_time TIMESTAMPTZ,
  ad_type TEXT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_name, date, campaign_id, asin)
);

CREATE INDEX IF NOT EXISTS idx_rpt_sp_client_date ON rpt_sponsored_products (client_name, date DESC);
CREATE INDEX IF NOT EXISTS idx_rpt_sp_date ON rpt_sponsored_products (date DESC);
CREATE INDEX IF NOT EXISTS idx_rpt_sp_pck ON rpt_sponsored_products (product_client_key);

COMMENT ON TABLE rpt_sponsored_products IS 'Sponsored Products advertising data from BigQuery';

-- 1.2 Sponsored Display
CREATE TABLE IF NOT EXISTS rpt_sponsored_display (
  id BIGSERIAL PRIMARY KEY,
  ad_id TEXT,
  asin TEXT,
  campaign_type TEXT,
  campaign_id TEXT,
  campaign_name TEXT,
  clicks BIGINT DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  spend NUMERIC(12,2) DEFAULT 0,
  sales NUMERIC(12,2) DEFAULT 0,
  orders BIGINT DEFAULT 0,
  acos NUMERIC(8,4),
  client_name TEXT,
  date DATE NOT NULL,
  product_client_key TEXT,
  request_time TIMESTAMPTZ,
  ad_type TEXT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_name, date, campaign_id, asin)
);

CREATE INDEX IF NOT EXISTS idx_rpt_sd_client_date ON rpt_sponsored_display (client_name, date DESC);
CREATE INDEX IF NOT EXISTS idx_rpt_sd_date ON rpt_sponsored_display (date DESC);
CREATE INDEX IF NOT EXISTS idx_rpt_sd_pck ON rpt_sponsored_display (product_client_key);

COMMENT ON TABLE rpt_sponsored_display IS 'Sponsored Display advertising data from BigQuery';

-- 1.3 Sponsored Brands
CREATE TABLE IF NOT EXISTS rpt_sponsored_brands (
  id BIGSERIAL PRIMARY KEY,
  ad_id TEXT,
  asin TEXT,
  campaign_type TEXT,
  campaign_id TEXT,
  campaign_name TEXT,
  clicks BIGINT DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  spend NUMERIC(12,2) DEFAULT 0,
  sales NUMERIC(12,2) DEFAULT 0,
  orders BIGINT DEFAULT 0,
  acos NUMERIC(8,4),
  client_id TEXT,
  client_name TEXT,
  date DATE NOT NULL,
  product_client_key TEXT,
  request_time TIMESTAMPTZ,
  ad_type TEXT,
  disc_order INT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_name, date, campaign_id, asin)
);

CREATE INDEX IF NOT EXISTS idx_rpt_sb_client_date ON rpt_sponsored_brands (client_name, date DESC);
CREATE INDEX IF NOT EXISTS idx_rpt_sb_date ON rpt_sponsored_brands (date DESC);
CREATE INDEX IF NOT EXISTS idx_rpt_sb_pck ON rpt_sponsored_brands (product_client_key);

COMMENT ON TABLE rpt_sponsored_brands IS 'Sponsored Brands advertising data from BigQuery';

-- 1.4 Sales
CREATE TABLE IF NOT EXISTS rpt_sales (
  id BIGSERIAL PRIMARY KEY,
  asin_child TEXT,
  asin_parent TEXT,
  client_id TEXT NOT NULL,
  date DATE NOT NULL,
  product_client_key TEXT,
  request_time TIMESTAMPTZ,
  units_ordered BIGINT DEFAULT 0,
  ordered_product_sales NUMERIC(12,2) DEFAULT 0,
  total_order_items BIGINT DEFAULT 0,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_id, date, asin_child)
);

CREATE INDEX IF NOT EXISTS idx_rpt_sales_client_date ON rpt_sales (client_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_rpt_sales_date ON rpt_sales (date DESC);
CREATE INDEX IF NOT EXISTS idx_rpt_sales_pck ON rpt_sales (product_client_key);

COMMENT ON TABLE rpt_sales IS 'Selling Partner sales data from BigQuery';

-- 1.5 Refunds
CREATE TABLE IF NOT EXISTS rpt_refunds (
  id BIGSERIAL PRIMARY KEY,
  client_id TEXT NOT NULL,
  date DATE NOT NULL,
  refund_rate NUMERIC(8,4),
  request_time TIMESTAMPTZ,
  units_refunded BIGINT DEFAULT 0,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_id, date)
);

CREATE INDEX IF NOT EXISTS idx_rpt_refunds_client_date ON rpt_refunds (client_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_rpt_refunds_date ON rpt_refunds (date DESC);

COMMENT ON TABLE rpt_refunds IS 'Refund metrics from BigQuery';

-- 1.6 Match Data
CREATE TABLE IF NOT EXISTS rpt_match (
  id BIGSERIAL PRIMARY KEY,
  asin TEXT,
  campaign_id TEXT,
  campaign_name TEXT,
  client_name TEXT,
  clicks BIGINT DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  spend NUMERIC(12,2) DEFAULT 0,
  sales NUMERIC(12,2) DEFAULT 0,
  date DATE NOT NULL,
  product_client_key TEXT,
  request_time TIMESTAMPTZ,
  ad_type TEXT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_name, date, campaign_id, asin)
);

CREATE INDEX IF NOT EXISTS idx_rpt_match_client_date ON rpt_match (client_name, date DESC);
CREATE INDEX IF NOT EXISTS idx_rpt_match_date ON rpt_match (date DESC);
CREATE INDEX IF NOT EXISTS idx_rpt_match_pck ON rpt_match (product_client_key);

COMMENT ON TABLE rpt_match IS 'Campaign match type analysis from BigQuery';

-- 1.7 Match Data v2
CREATE TABLE IF NOT EXISTS rpt_match_v2 (
  id BIGSERIAL PRIMARY KEY,
  asin TEXT,
  campaign_id TEXT,
  campaign_name TEXT,
  client_name TEXT,
  clicks BIGINT DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  spend NUMERIC(12,2) DEFAULT 0,
  sales NUMERIC(12,2) DEFAULT 0,
  date DATE NOT NULL,
  product_client_key TEXT,
  request_time TIMESTAMPTZ,
  ad_type TEXT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_name, date, campaign_id, asin)
);

CREATE INDEX IF NOT EXISTS idx_rpt_match_v2_client_date ON rpt_match_v2 (client_name, date DESC);
CREATE INDEX IF NOT EXISTS idx_rpt_match_v2_date ON rpt_match_v2 (date DESC);
CREATE INDEX IF NOT EXISTS idx_rpt_match_v2_pck ON rpt_match_v2 (product_client_key);

COMMENT ON TABLE rpt_match_v2 IS 'Campaign match type analysis v2 from BigQuery';

-- 1.8 SNS Performance
CREATE TABLE IF NOT EXISTS rpt_sns_performance (
  id BIGSERIAL PRIMARY KEY,
  active_subscriptions BIGINT DEFAULT 0,
  asin TEXT,
  client_name TEXT,
  marketplace_id TEXT,
  marketplace_name TEXT,
  product_client_key TEXT,
  request_start_date DATE,
  request_end_date DATE,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_name, asin, request_start_date)
);

CREATE INDEX IF NOT EXISTS idx_rpt_sns_perf_client ON rpt_sns_performance (client_name);
CREATE INDEX IF NOT EXISTS idx_rpt_sns_perf_pck ON rpt_sns_performance (product_client_key);

COMMENT ON TABLE rpt_sns_performance IS 'Subscribe & Save performance from BigQuery';

-- 1.9 SNS Forecast
CREATE TABLE IF NOT EXISTS rpt_sns_forecast (
  id BIGSERIAL PRIMARY KEY,
  asin TEXT,
  client_name TEXT,
  marketplace_id TEXT,
  marketplace_name TEXT,
  product_client_key TEXT,
  snapshot_date DATE,
  request_end_date DATE,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_name, asin, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_rpt_sns_fc_client ON rpt_sns_forecast (client_name);
CREATE INDEX IF NOT EXISTS idx_rpt_sns_fc_pck ON rpt_sns_forecast (product_client_key);

COMMENT ON TABLE rpt_sns_forecast IS 'Subscribe & Save forecast data from BigQuery';

-- 1.10 Inventory
CREATE TABLE IF NOT EXISTS rpt_inventory (
  id BIGSERIAL PRIMARY KEY,
  asin TEXT,
  available BIGINT DEFAULT 0,
  client_name TEXT,
  fnsku TEXT,
  inv_age_0_to_90_days BIGINT DEFAULT 0,
  inv_age_91_to_180_days BIGINT DEFAULT 0,
  inv_age_181_to_270_days BIGINT DEFAULT 0,
  inv_age_271_to_365_days BIGINT DEFAULT 0,
  inv_age_365_plus_days BIGINT DEFAULT 0,
  product_name TEXT,
  product_client_key TEXT,
  sku TEXT,
  snapshot_date DATE NOT NULL,
  units_shipped_t7 BIGINT DEFAULT 0,
  units_shipped_t30 BIGINT DEFAULT 0,
  units_shipped_t60 BIGINT DEFAULT 0,
  units_shipped_t90 BIGINT DEFAULT 0,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_name, asin, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_rpt_inv_client_date ON rpt_inventory (client_name, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_rpt_inv_date ON rpt_inventory (snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_rpt_inv_pck ON rpt_inventory (product_client_key);

COMMENT ON TABLE rpt_inventory IS 'FBA inventory aging and velocity from BigQuery';

-- 1.11 Settlement
CREATE TABLE IF NOT EXISTS rpt_settlement (
  id BIGSERIAL PRIMARY KEY,
  daton_batch_id TEXT,
  daton_batch_runtime TIMESTAMPTZ,
  daton_user_id TEXT,
  client_name TEXT,
  posted_date DATE,
  report_start_date DATE,
  report_end_date DATE,
  report_request_time TIMESTAMPTZ,
  subcategory_id TEXT,
  amount NUMERIC(12,2),
  amount_type TEXT,
  amount_description TEXT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_name, posted_date, subcategory_id, daton_batch_id)
);

CREATE INDEX IF NOT EXISTS idx_rpt_settle_client_date ON rpt_settlement (client_name, posted_date DESC);
CREATE INDEX IF NOT EXISTS idx_rpt_settle_date ON rpt_settlement (posted_date DESC);
CREATE INDEX IF NOT EXISTS idx_rpt_settle_subcat ON rpt_settlement (subcategory_id);

COMMENT ON TABLE rpt_settlement IS 'Financial settlement data from BigQuery';

-- =============================================================================
-- 2. DIMENSION TABLES (full refresh)
-- =============================================================================

-- 2.1 Dim Clients
CREATE TABLE IF NOT EXISTS rpt_dim_clients (
  client_id TEXT PRIMARY KEY,
  brand TEXT,
  admin TEXT,
  pod TEXT,
  squad TEXT,
  market TEXT,
  match TEXT,
  duplicate BOOLEAN DEFAULT false,
  synced_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE rpt_dim_clients IS 'Client/partner dimension from BigQuery';

-- 2.2 Dim Products
CREATE TABLE IF NOT EXISTS rpt_dim_products (
  id BIGSERIAL PRIMARY KEY,
  asin TEXT NOT NULL,
  asin_nickname TEXT,
  client_id TEXT,
  nickname TEXT,
  parent_asin TEXT,
  report_start_date DATE,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_id, asin)
);

CREATE INDEX IF NOT EXISTS idx_rpt_dim_prod_client ON rpt_dim_products (client_id);

COMMENT ON TABLE rpt_dim_products IS 'Product dimension from BigQuery';

-- 2.3 Dim ASINs
CREATE TABLE IF NOT EXISTS rpt_dim_asins (
  id BIGSERIAL PRIMARY KEY,
  asin TEXT NOT NULL,
  client_id TEXT,
  duplicate BOOLEAN DEFAULT false,
  external_id TEXT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_id, asin)
);

CREATE INDEX IF NOT EXISTS idx_rpt_dim_asins_client ON rpt_dim_asins (client_id);

COMMENT ON TABLE rpt_dim_asins IS 'ASIN dimension from BigQuery';

-- 2.4 Bridge Product Client
CREATE TABLE IF NOT EXISTS rpt_bridge_product_client (
  product_client_key TEXT PRIMARY KEY,
  asin_and_product TEXT,
  asin_key TEXT,
  client_id TEXT,
  synced_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rpt_bridge_client ON rpt_bridge_product_client (client_id);

COMMENT ON TABLE rpt_bridge_product_client IS 'Bridge table linking products to clients';

-- 2.5 Calendar (generated locally, not synced from BQ)
CREATE TABLE IF NOT EXISTS rpt_calendar (
  date DATE PRIMARY KEY,
  date_as_integer INT NOT NULL,
  day INT NOT NULL,
  day_of_week INT NOT NULL,
  day_of_week_name TEXT NOT NULL,
  day_of_week_short TEXT NOT NULL,
  week_of_year INT NOT NULL,
  month INT NOT NULL,
  month_name TEXT NOT NULL,
  month_short TEXT NOT NULL,
  quarter INT NOT NULL,
  year INT NOT NULL,
  is_weekend BOOLEAN NOT NULL DEFAULT false,
  iso_week INT NOT NULL
);

COMMENT ON TABLE rpt_calendar IS 'Date dimension table (generated locally, 2020-2030)';

-- 2.6 Campaign Type
CREATE TABLE IF NOT EXISTS rpt_campaign_type (
  type TEXT PRIMARY KEY
);

COMMENT ON TABLE rpt_campaign_type IS 'Campaign type lookup';

-- 2.7 Sponsored Type
CREATE TABLE IF NOT EXISTS rpt_sponsored_type (
  type TEXT PRIMARY KEY
);

COMMENT ON TABLE rpt_sponsored_type IS 'Sponsored ad type lookup';

-- 2.8 Subcategories
CREATE TABLE IF NOT EXISTS rpt_subcategories (
  subcategory_id TEXT PRIMARY KEY,
  amount_description TEXT,
  amount_type TEXT,
  category TEXT,
  label TEXT
);

COMMENT ON TABLE rpt_subcategories IS 'Settlement report subcategory lookup';

-- =============================================================================
-- 3. CONFIG / PARAMETER TABLES (one-time seed)
-- =============================================================================

-- 3.1 Date Filter
CREATE TABLE IF NOT EXISTS rpt_date_filter (
  date DATE PRIMARY KEY,
  filter TEXT,
  color TEXT
);

-- 3.2 Metrics
CREATE TABLE IF NOT EXISTS rpt_metrics (
  metric TEXT PRIMARY KEY,
  sequence INT NOT NULL DEFAULT 0
);

-- 3.3 Comparison Options
CREATE TABLE IF NOT EXISTS rpt_comparison_options (
  comparison TEXT PRIMARY KEY,
  sort INT NOT NULL DEFAULT 0
);

-- 3.4 Target Days on Hand
CREATE TABLE IF NOT EXISTS rpt_target_days_on_hand (
  label TEXT PRIMARY KEY,
  sequence INT NOT NULL DEFAULT 0,
  value NUMERIC
);

-- 3.5 Selected Period
CREATE TABLE IF NOT EXISTS rpt_selected_period (
  label TEXT PRIMARY KEY,
  sequence INT NOT NULL DEFAULT 0,
  value NUMERIC
);

-- 3.6 Lead Time
CREATE TABLE IF NOT EXISTS rpt_lead_time (
  lead_time TEXT PRIMARY KEY,
  lead_time_value NUMERIC
);

-- 3.7 Account Performance KPI
CREATE TABLE IF NOT EXISTS rpt_account_performance_kpi (
  kpi TEXT PRIMARY KEY,
  sort_order INT NOT NULL DEFAULT 0
);

-- 3.8 Toggle tables (UI visibility controls)
CREATE TABLE IF NOT EXISTS rpt_toggle_acos (show BOOLEAN PRIMARY KEY DEFAULT true);
CREATE TABLE IF NOT EXISTS rpt_toggle_tacos (show BOOLEAN PRIMARY KEY DEFAULT true);
CREATE TABLE IF NOT EXISTS rpt_toggle_sales (show BOOLEAN PRIMARY KEY DEFAULT true);
CREATE TABLE IF NOT EXISTS rpt_toggle_spend (show BOOLEAN PRIMARY KEY DEFAULT true);
CREATE TABLE IF NOT EXISTS rpt_toggle_cvr (show BOOLEAN PRIMARY KEY DEFAULT true);

-- 3.9 All Metrics tables (metric selection lists)
CREATE TABLE IF NOT EXISTS rpt_all_metrics_sns (
  metric TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS rpt_all_metrics_inventory (
  metric TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS rpt_all_metrics_settlement (
  metric TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS rpt_all_metrics_match (
  metric TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS rpt_all_metrics_sales (
  metric TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS rpt_all_metrics_ppc (
  metric TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS rpt_all_metrics_dashboard (
  metric TEXT PRIMARY KEY
);

-- =============================================================================
-- 4. FOREIGN KEY RELATIONSHIPS (matching Power BI model)
-- =============================================================================

-- Drop existing constraints first (idempotent re-runs)
ALTER TABLE rpt_bridge_product_client DROP CONSTRAINT IF EXISTS fk_bridge_client;
ALTER TABLE rpt_refunds DROP CONSTRAINT IF EXISTS fk_refunds_client;
ALTER TABLE rpt_dim_products DROP CONSTRAINT IF EXISTS fk_dim_products_client;
ALTER TABLE rpt_dim_asins DROP CONSTRAINT IF EXISTS fk_dim_asins_client;
ALTER TABLE rpt_settlement DROP CONSTRAINT IF EXISTS fk_settlement_subcategory;

-- Bridge → DimClients
ALTER TABLE rpt_bridge_product_client
  ADD CONSTRAINT fk_bridge_client
  FOREIGN KEY (client_id) REFERENCES rpt_dim_clients(client_id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- Refunds → DimClients
ALTER TABLE rpt_refunds
  ADD CONSTRAINT fk_refunds_client
  FOREIGN KEY (client_id) REFERENCES rpt_dim_clients(client_id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- DimProducts → DimClients
ALTER TABLE rpt_dim_products
  ADD CONSTRAINT fk_dim_products_client
  FOREIGN KEY (client_id) REFERENCES rpt_dim_clients(client_id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- DimASINs → DimClients
ALTER TABLE rpt_dim_asins
  ADD CONSTRAINT fk_dim_asins_client
  FOREIGN KEY (client_id) REFERENCES rpt_dim_clients(client_id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- Note: Fact table → Bridge relationships use product_client_key TEXT matching.
-- Foreign keys on text fields with 1M+ rows can be expensive. Instead we use
-- indexed joins at query time. The indexes created above on product_client_key
-- ensure fast lookups.

-- Settlement → Subcategories
ALTER TABLE rpt_settlement
  ADD CONSTRAINT fk_settlement_subcategory
  FOREIGN KEY (subcategory_id) REFERENCES rpt_subcategories(subcategory_id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- =============================================================================
-- 5. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE rpt_sync_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpt_sponsored_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpt_sponsored_display ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpt_sponsored_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpt_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpt_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpt_match ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpt_match_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpt_sns_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpt_sns_forecast ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpt_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpt_settlement ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpt_dim_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpt_dim_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpt_dim_asins ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpt_bridge_product_client ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpt_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpt_campaign_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpt_sponsored_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpt_subcategories ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (used by sync engine and admin API routes)
-- Authenticated users get read access to all reporting tables
CREATE POLICY "Authenticated read reporting" ON rpt_sponsored_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read reporting" ON rpt_sponsored_display FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read reporting" ON rpt_sponsored_brands FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read reporting" ON rpt_sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read reporting" ON rpt_refunds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read reporting" ON rpt_match FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read reporting" ON rpt_match_v2 FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read reporting" ON rpt_sns_performance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read reporting" ON rpt_sns_forecast FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read reporting" ON rpt_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read reporting" ON rpt_settlement FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read reporting" ON rpt_dim_clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read reporting" ON rpt_dim_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read reporting" ON rpt_dim_asins FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read reporting" ON rpt_bridge_product_client FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read reporting" ON rpt_calendar FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read reporting" ON rpt_campaign_type FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read reporting" ON rpt_sponsored_type FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read reporting" ON rpt_subcategories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read reporting" ON rpt_sync_config FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- 6. SEED SYNC CONFIG
-- =============================================================================

-- Source: Pedro's materialized BQ tables (daily 07:00 UTC scheduled queries)
-- See: Sophie_Society_Power_BI_Optimization_Report (Feb 2026)
INSERT INTO rpt_sync_config (table_name, bigquery_source, sync_strategy, date_field, unique_key_columns) VALUES
-- Fact tables (incremental)
('rpt_sponsored_products', 'pbi_sp_par_materialized', 'incremental', 'date', ARRAY['client_name', 'date', 'campaign_id', 'asin']),
('rpt_sponsored_display', 'pbi_sd_par_materialized', 'incremental', 'date', ARRAY['client_name', 'date', 'campaign_id', 'asin']),
('rpt_sponsored_brands', 'pbi_sb_str_materialized', 'incremental', 'date', ARRAY['client_name', 'date', 'campaign_id', 'asin']),
('rpt_sales', 'pbi_sellingpartner_sales_materialized', 'incremental', 'date', ARRAY['client_id', 'date', 'asin_child']),
('rpt_refunds', 'pbi_sellingpartner_refunds_materialized', 'incremental', 'date', ARRAY['client_id', 'date']),
('rpt_match', 'pbi_match_v2_materialized', 'incremental', 'date', ARRAY['client_name', 'date', 'campaign_id', 'asin']),
('rpt_match_v2', 'pbi_match_v2_materialized', 'incremental', 'date', ARRAY['client_name', 'date', 'campaign_id', 'asin']),
('rpt_sns_performance', 'pbi_sns_performance_materialized', 'incremental', 'request_start_date', ARRAY['client_name', 'asin', 'request_start_date']),
('rpt_sns_forecast', 'pbi_sns_forecast_materialized', 'incremental', 'snapshot_date', ARRAY['client_name', 'asin', 'snapshot_date']),
('rpt_inventory', 'pbi_inventory_materialized', 'incremental', 'snapshot_date', ARRAY['client_name', 'asin', 'snapshot_date']),
('rpt_settlement', 'pbi_settlement_materialized', 'incremental', 'posted_date', ARRAY['client_name', 'posted_date', 'subcategory_id', 'daton_batch_id']),
-- Dimension tables (full refresh)
('rpt_dim_clients', 'ext_client_admin', 'full_refresh', NULL, ARRAY['client_id']),
('rpt_dim_products', 'pbi_dim_products_materialized', 'full_refresh', NULL, ARRAY['client_id', 'asin']),
('rpt_dim_asins', 'TBD', 'full_refresh', NULL, ARRAY['client_id', 'asin']),
('rpt_bridge_product_client', 'pbi_bridge_product_client_materialized', 'full_refresh', NULL, ARRAY['product_client_key']),
('rpt_campaign_type', 'TBD', 'full_refresh', NULL, ARRAY['type']),
('rpt_sponsored_type', 'TBD', 'full_refresh', NULL, ARRAY['type']),
('rpt_subcategories', 'TBD', 'full_refresh', NULL, ARRAY['subcategory_id'])
ON CONFLICT (table_name) DO NOTHING;
