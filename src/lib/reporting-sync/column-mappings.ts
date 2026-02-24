/**
 * Reporting Sync Column Mappings
 *
 * Maps BigQuery column names to Supabase column names for each reporting table.
 * Verified against actual BigQuery INFORMATION_SCHEMA on 2026-02-23.
 *
 * BigQuery project: sophie-society-reporting
 * BigQuery dataset: pbi
 */

import type { ColumnDef } from './types'

/**
 * Column mappings per Supabase table.
 *
 * Each entry maps BigQuery column names → Supabase column names.
 * Only listed columns will be synced; extra BQ columns are ignored.
 */
export const TABLE_COLUMN_MAPPINGS: Record<string, ColumnDef[]> = {
  // =========================================================================
  // FACT TABLES (incremental sync by date)
  // =========================================================================

  // Source: pbi_sp_par_materialized
  rpt_sponsored_products: [
    { bq: 'client_name', sb: 'client_name' },
    { bq: 'date', sb: 'date', type: 'date' },
    { bq: 'request_time', sb: 'request_time', type: 'timestamptz' },
    { bq: 'campaign_id', sb: 'campaign_id' },
    { bq: 'ad_id', sb: 'ad_id' },
    { bq: 'campaign_name', sb: 'campaign_name' },
    { bq: 'asin', sb: 'asin' },
    { bq: 'impressions', sb: 'impressions', type: 'bigint' },
    { bq: 'clicks', sb: 'clicks', type: 'bigint' },
    { bq: 'ppc_spend', sb: 'spend', type: 'numeric' },
    { bq: 'ppc_sales', sb: 'sales', type: 'numeric' },
    { bq: 'ppc_orders', sb: 'orders', type: 'bigint' },
    { bq: 'ppc_units', sb: 'ppc_units', type: 'numeric' },
    { bq: 'ProductClientKey', sb: 'product_client_key' },
  ],

  // Source: pbi_sd_par_materialized
  rpt_sponsored_display: [
    { bq: 'client_name', sb: 'client_name' },
    { bq: 'date', sb: 'date', type: 'date' },
    { bq: 'request_time', sb: 'request_time', type: 'timestamptz' },
    { bq: 'campaign_id', sb: 'campaign_id' },
    { bq: 'ad_id', sb: 'ad_id' },
    { bq: 'campaign_name', sb: 'campaign_name' },
    { bq: 'asin', sb: 'asin' },
    { bq: 'impressions', sb: 'impressions', type: 'bigint' },
    { bq: 'clicks', sb: 'clicks', type: 'bigint' },
    { bq: 'ppc_spend', sb: 'spend', type: 'numeric' },
    { bq: 'ppc_sales', sb: 'sales', type: 'numeric' },
    { bq: 'ppc_orders', sb: 'orders', type: 'bigint' },
    { bq: 'ppc_units', sb: 'ppc_units', type: 'numeric' },
    { bq: 'ProductClientKey', sb: 'product_client_key' },
  ],

  // Source: pbi_sb_str_materialized
  // NOTE: Uses client_id (not client_name like SP/SD), no ad_id
  rpt_sponsored_brands: [
    { bq: 'client_id', sb: 'client_id' },
    { bq: 'date', sb: 'date', type: 'date' },
    { bq: 'request_time', sb: 'request_time', type: 'timestamptz' },
    { bq: 'campaign_id', sb: 'campaign_id' },
    { bq: 'campaign_name', sb: 'campaign_name' },
    { bq: 'asin', sb: 'asin' },
    { bq: 'impressions', sb: 'impressions', type: 'bigint' },
    { bq: 'clicks', sb: 'clicks', type: 'bigint' },
    { bq: 'ppc_spend', sb: 'spend', type: 'numeric' },
    { bq: 'ppc_sales', sb: 'sales', type: 'numeric' },
    { bq: 'ppc_orders', sb: 'orders', type: 'bigint' },
    { bq: 'ProductClientKey', sb: 'product_client_key' },
  ],

  // Source: pbi_sellingpartner_sales_materialized
  rpt_sales: [
    { bq: 'client_id', sb: 'client_id' },
    { bq: 'date', sb: 'date', type: 'date' },
    { bq: 'request_time', sb: 'request_time', type: 'timestamptz' },
    { bq: 'asin_child', sb: 'asin_child' },
    { bq: 'asin_parent', sb: 'asin_parent' },
    { bq: 'sessions', sb: 'sessions', type: 'bigint' },
    { bq: 'sessions_b2b', sb: 'sessions_b2b', type: 'bigint' },
    { bq: 'units_ordered', sb: 'units_ordered', type: 'bigint' },
    { bq: 'units_ordered_b2b', sb: 'units_ordered_b2b', type: 'bigint' },
    { bq: 'ordered_product_sales_amount', sb: 'ordered_product_sales', type: 'numeric' },
    { bq: 'ordered_product_sales_b2b_amount', sb: 'ordered_product_sales_b2b', type: 'numeric' },
    { bq: 'total_order_items', sb: 'total_order_items', type: 'bigint' },
    { bq: 'total_order_items_b2b', sb: 'total_order_items_b2b', type: 'bigint' },
    { bq: 'ProductClientKey', sb: 'product_client_key' },
  ],

  // Source: pbi_sellingpartner_refunds_materialized
  rpt_refunds: [
    { bq: 'client_id', sb: 'client_id' },
    { bq: 'date', sb: 'date', type: 'date' },
    { bq: 'request_time', sb: 'request_time', type: 'timestamptz' },
    { bq: 'units_refunded', sb: 'units_refunded', type: 'bigint' },
    { bq: 'refund_rate', sb: 'refund_rate', type: 'numeric' },
  ],

  // Source: pbi_match_unified_materialized_v2
  rpt_match: [
    { bq: 'client_name', sb: 'client_name' },
    { bq: 'type', sb: 'ad_type' },
    { bq: 'date', sb: 'date', type: 'date' },
    { bq: 'request_time', sb: 'request_time', type: 'timestamptz' },
    { bq: 'campaign_id', sb: 'campaign_id' },
    { bq: 'campaign_name', sb: 'campaign_name' },
    { bq: 'asin', sb: 'asin' },
    { bq: 'match_type', sb: 'match_type' },
    { bq: 'GROUP', sb: 'match_group' },
    { bq: 'SUBGROUP', sb: 'match_subgroup' },
    { bq: 'ppc_revenue', sb: 'sales', type: 'numeric' },
    { bq: 'ppc_cost', sb: 'spend', type: 'numeric' },
    { bq: 'impressions', sb: 'impressions', type: 'bigint' },
    { bq: 'clicks', sb: 'clicks', type: 'bigint' },
    { bq: 'ProductClientKey', sb: 'product_client_key' },
  ],

  // Source: pbi_match_unified_materialized_v2
  rpt_match_v2: [
    { bq: 'client_name', sb: 'client_name' },
    { bq: 'type', sb: 'ad_type' },
    { bq: 'date', sb: 'date', type: 'date' },
    { bq: 'request_time', sb: 'request_time', type: 'timestamptz' },
    { bq: 'campaign_id', sb: 'campaign_id' },
    { bq: 'campaign_name', sb: 'campaign_name' },
    { bq: 'asin', sb: 'asin' },
    { bq: 'match_type', sb: 'match_type' },
    { bq: 'GROUP', sb: 'match_group' },
    { bq: 'SUBGROUP', sb: 'match_subgroup' },
    { bq: 'ppc_revenue', sb: 'sales', type: 'numeric' },
    { bq: 'ppc_cost', sb: 'spend', type: 'numeric' },
    { bq: 'impressions', sb: 'impressions', type: 'bigint' },
    { bq: 'clicks', sb: 'clicks', type: 'bigint' },
    { bq: 'ProductClientKey', sb: 'product_client_key' },
  ],

  // Source: pbi_sns_performance_materialized
  rpt_sns_performance: [
    { bq: 'client_name', sb: 'client_name' },
    { bq: 'RequestStartDate', sb: 'request_start_date', type: 'date' },
    { bq: 'RequestEndDate', sb: 'request_end_date', type: 'date' },
    { bq: 'sellingPartnerId', sb: 'selling_partner_id' },
    { bq: 'marketplaceName', sb: 'marketplace_name' },
    { bq: 'marketplaceId', sb: 'marketplace_id' },
    { bq: 'asin', sb: 'asin' },
    { bq: 'shippedSubscriptionUnits', sb: 'shipped_subscription_units', type: 'bigint' },
    { bq: 'activeSubscriptions', sb: 'active_subscriptions', type: 'bigint' },
    { bq: 'totalSubscriptionsRevenue', sb: 'total_subscriptions_revenue', type: 'numeric' },
    { bq: 'revenuePenetration', sb: 'revenue_penetration', type: 'numeric' },
    { bq: 'shareOfCouponSubscriptions', sb: 'share_of_coupon_subscriptions', type: 'numeric' },
    { bq: 'ProductClientKey', sb: 'product_client_key' },
  ],

  // Source: pbi_sns_forecast_materialized
  rpt_sns_forecast: [
    { bq: 'client_name', sb: 'client_name' },
    { bq: 'snapshot_date', sb: 'snapshot_date', type: 'date' },
    { bq: 'request_end_date', sb: 'request_end_date', type: 'date' },
    { bq: 'sellingPartnerId', sb: 'selling_partner_id' },
    { bq: 'marketplaceName', sb: 'marketplace_name' },
    { bq: 'marketplaceId', sb: 'marketplace_id' },
    { bq: 'asin', sb: 'asin' },
    { bq: 'next30DayTotalSubscriptionsRevenue', sb: 'next_30d_revenue', type: 'numeric' },
    { bq: 'next60DayTotalSubscriptionsRevenue', sb: 'next_60d_revenue', type: 'numeric' },
    { bq: 'next90DayTotalSubscriptionsRevenue', sb: 'next_90d_revenue', type: 'numeric' },
    { bq: 'next30DayShippedSubscriptionUnits', sb: 'next_30d_units', type: 'bigint' },
    { bq: 'next60DayShippedSubscriptionUnits', sb: 'next_60d_units', type: 'bigint' },
    { bq: 'next90DayShippedSubscriptionUnits', sb: 'next_90d_units', type: 'bigint' },
    { bq: 'ProductClientKey', sb: 'product_client_key' },
  ],

  // Source: pbi_inventory_materialized
  rpt_inventory: [
    { bq: 'client_name', sb: 'client_name' },
    { bq: 'snapshot_date', sb: 'snapshot_date', type: 'date' },
    { bq: 'asin', sb: 'asin' },
    { bq: 'sku', sb: 'sku' },
    { bq: 'fnsku', sb: 'fnsku' },
    { bq: 'product_name', sb: 'product_name' },
    { bq: 'available', sb: 'available', type: 'bigint' },
    { bq: 'inv_age_0_to_90_days', sb: 'inv_age_0_to_90_days', type: 'bigint' },
    { bq: 'inv_age_91_to_180_days', sb: 'inv_age_91_to_180_days', type: 'bigint' },
    { bq: 'inv_age_181_to_270_days', sb: 'inv_age_181_to_270_days', type: 'bigint' },
    { bq: 'inv_age_271_to_365_days', sb: 'inv_age_271_to_365_days', type: 'bigint' },
    { bq: 'inv_age_365_plus_days', sb: 'inv_age_365_plus_days', type: 'bigint' },
    { bq: 'units_shipped_t7', sb: 'units_shipped_t7', type: 'bigint' },
    { bq: 'units_shipped_t30', sb: 'units_shipped_t30', type: 'bigint' },
    { bq: 'units_shipped_t60', sb: 'units_shipped_t60', type: 'bigint' },
    { bq: 'units_shipped_t90', sb: 'units_shipped_t90', type: 'bigint' },
    { bq: 'ProductClientKey', sb: 'product_client_key' },
  ],

  // Source: pbi_settlement_materialized
  // NOTE: ReportstartDate/ReportendDate have non-standard casing in BQ
  rpt_settlement: [
    { bq: 'client_name', sb: 'client_name' },
    { bq: 'ReportstartDate', sb: 'report_start_date', type: 'timestamptz' },
    { bq: 'ReportendDate', sb: 'report_end_date', type: 'timestamptz' },
    { bq: 'ReportRequestTime', sb: 'report_request_time', type: 'timestamptz' },
    { bq: 'sellingPartnerId', sb: 'selling_partner_id' },
    { bq: 'marketplaceName', sb: 'marketplace_name_report' },
    { bq: 'marketplaceId', sb: 'marketplace_id' },
    { bq: 'settlement_id', sb: 'settlement_id' },
    { bq: 'settlement_start_date', sb: 'settlement_start_date' },
    { bq: 'settlement_end_date', sb: 'settlement_end_date' },
    { bq: 'deposit_date', sb: 'deposit_date' },
    { bq: 'total_amount', sb: 'total_amount' },
    { bq: 'currency', sb: 'currency' },
    { bq: 'transaction_type', sb: 'transaction_type' },
    { bq: 'order_id', sb: 'order_id' },
    { bq: 'merchant_order_id', sb: 'merchant_order_id' },
    { bq: 'adjustment_id', sb: 'adjustment_id' },
    { bq: 'shipment_id', sb: 'shipment_id' },
    { bq: 'marketplace_name', sb: 'marketplace_name' },
    { bq: 'amount_type', sb: 'amount_type' },
    { bq: 'amount_description', sb: 'amount_description' },
    { bq: 'amount', sb: 'amount', type: 'numeric' },
    { bq: 'fulfillment_id', sb: 'fulfillment_id' },
    { bq: 'posted_date', sb: 'posted_date', type: 'date' },
    { bq: 'posted_date_time', sb: 'posted_date_time' },
    { bq: 'order_item_code', sb: 'order_item_code' },
    { bq: 'merchant_order_item_id', sb: 'merchant_order_item_id' },
    { bq: 'merchant_adjustment_item_id', sb: 'merchant_adjustment_item_id' },
    { bq: 'sku', sb: 'sku' },
    { bq: 'quantity_purchased', sb: 'quantity_purchased', type: 'bigint' },
    { bq: 'promotion_id', sb: 'promotion_id' },
    { bq: '_daton_user_id', sb: 'daton_user_id' },
    { bq: '_daton_batch_runtime', sb: 'daton_batch_runtime' },
    { bq: '_daton_batch_id', sb: 'daton_batch_id' },
  ],

  // =========================================================================
  // DIMENSION TABLES (full refresh)
  // =========================================================================

  // Source: ext_client_admin
  rpt_dim_clients: [
    { bq: 'client_id', sb: 'client_id' },
    { bq: 'Brand', sb: 'brand' },
    { bq: 'Market', sb: 'market' },
    { bq: 'POD', sb: 'pod' },
    { bq: 'Squad', sb: 'squad', type: 'int' },
    { bq: 'Admin', sb: 'admin' },
    { bq: 'Match', sb: 'match', type: 'boolean' },
  ],

  // Source: pbi_dim_products_materialized
  rpt_dim_products: [
    { bq: 'client_id', sb: 'client_id' },
    { bq: 'asin', sb: 'asin' },
    { bq: 'parent_asin', sb: 'parent_asin' },
    { bq: 'product_name', sb: 'product_name' },
    { bq: 'report_start_date', sb: 'report_start_date', type: 'date' },
    { bq: 'ProductClientKey', sb: 'product_client_key' },
  ],

  // Source: TBD (no BigQuery source available yet)
  rpt_dim_asins: [],

  // Source: pbi_bridge_product_client_materialized
  rpt_bridge_product_client: [
    { bq: 'client_id', sb: 'client_id' },
    { bq: 'asin_key', sb: 'asin_key' },
    { bq: 'ProductClientKey', sb: 'product_client_key' },
  ],

  // =========================================================================
  // LOOKUP TABLES (manual seed, TBD sources)
  // =========================================================================

  rpt_campaign_type: [],
  rpt_sponsored_type: [],
  rpt_subcategories: [],
}

/**
 * Get the column mappings for a table, falling back to
 * identity mapping (bq name = sb name) if not defined.
 */
export function getColumnMappings(tableName: string): ColumnDef[] {
  return TABLE_COLUMN_MAPPINGS[tableName] || []
}

/**
 * Transform a BigQuery row into a Supabase-ready record
 * using the column mappings for the given table.
 */
export function transformRow(
  tableName: string,
  bqRow: Record<string, unknown>
): Record<string, unknown> {
  const mappings = getColumnMappings(tableName)
  if (mappings.length === 0) {
    // No explicit mappings: pass through with lowercase keys
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(bqRow)) {
      result[key.toLowerCase().replace(/\s+/g, '_')] = value
    }
    return result
  }

  const result: Record<string, unknown> = {}

  for (const mapping of mappings) {
    const raw = bqRow[mapping.bq]

    // Skip null/undefined values
    if (raw === null || raw === undefined) {
      result[mapping.sb] = null
      continue
    }

    // Apply type coercion
    result[mapping.sb] = coerceValue(raw, mapping.type)
  }

  return result
}

/**
 * Coerce a BigQuery value to the expected Supabase type.
 */
function coerceValue(value: unknown, type?: ColumnDef['type']): unknown {
  if (value === null || value === undefined) return null

  // BigQuery date objects
  if (value && typeof value === 'object' && 'value' in (value as Record<string, unknown>)) {
    value = (value as Record<string, unknown>).value
  }

  // BigQuery Date objects → ISO string
  if (value instanceof Date) {
    return type === 'date'
      ? value.toISOString().split('T')[0]
      : value.toISOString()
  }

  if (!type || type === 'text') return String(value)

  switch (type) {
    case 'numeric': {
      const num = Number(value)
      return isNaN(num) ? null : num
    }
    case 'bigint':
    case 'int': {
      const int = parseInt(String(value), 10)
      return isNaN(int) ? null : int
    }
    case 'date': {
      const str = String(value)
      // Already ISO format?
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.split('T')[0]
      const parsed = new Date(str)
      return isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0]
    }
    case 'timestamptz': {
      const str = String(value)
      const parsed = new Date(str)
      return isNaN(parsed.getTime()) ? null : parsed.toISOString()
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value
      const str = String(value).toLowerCase()
      return str === 'true' || str === '1' || str === 'yes'
    }
    default:
      return value
  }
}
