/**
 * Seed Reporting Config Tables
 *
 * Seeds the small config/parameter tables that Power BI uses for UI state.
 * These are one-time seeds; update values manually in Supabase as needed.
 *
 * Run with: npx tsx src/scripts/seed-reporting-config.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL env vars.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function seedTable(tableName: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    console.log(`  ${tableName}: skipped (no data)`)
    return
  }

  const { error } = await supabase
    .from(tableName)
    .upsert(rows)

  if (error) {
    console.error(`  ${tableName}: ERROR - ${error.message}`)
  } else {
    console.log(`  ${tableName}: ${rows.length} rows`)
  }
}

async function seedConfigTables() {
  console.log('Seeding reporting config tables...\n')

  // Campaign Type
  await seedTable('rpt_campaign_type', [
    { type: 'Sponsored Products' },
    { type: 'Sponsored Brands' },
    { type: 'Sponsored Display' },
  ])

  // Sponsored Type
  await seedTable('rpt_sponsored_type', [
    { type: 'Sponsored Products' },
    { type: 'Sponsored Brands' },
    { type: 'Sponsored Brands Video' },
    { type: 'Sponsored Display' },
  ])

  // Metrics
  await seedTable('rpt_metrics', [
    { metric: 'Clicks', sequence: 1 },
    { metric: 'Impressions', sequence: 2 },
    { metric: 'Spend', sequence: 3 },
    { metric: 'Sales', sequence: 4 },
    { metric: 'Orders', sequence: 5 },
    { metric: 'ACOS', sequence: 6 },
    { metric: 'ROAS', sequence: 7 },
    { metric: 'CPC', sequence: 8 },
    { metric: 'CTR', sequence: 9 },
    { metric: 'CVR', sequence: 10 },
  ])

  // Comparison Options
  await seedTable('rpt_comparison_options', [
    { comparison: 'Previous Period', sort: 1 },
    { comparison: 'Same Period Last Year', sort: 2 },
    { comparison: 'None', sort: 3 },
  ])

  // Target Days on Hand
  await seedTable('rpt_target_days_on_hand', [
    { label: '30 Days', sequence: 1, value: 30 },
    { label: '60 Days', sequence: 2, value: 60 },
    { label: '90 Days', sequence: 3, value: 90 },
    { label: '120 Days', sequence: 4, value: 120 },
  ])

  // Selected Period
  await seedTable('rpt_selected_period', [
    { label: 'Last 7 Days', sequence: 1, value: 7 },
    { label: 'Last 14 Days', sequence: 2, value: 14 },
    { label: 'Last 30 Days', sequence: 3, value: 30 },
    { label: 'Last 60 Days', sequence: 4, value: 60 },
    { label: 'Last 90 Days', sequence: 5, value: 90 },
  ])

  // Lead Time
  await seedTable('rpt_lead_time', [
    { lead_time: '7 Days', lead_time_value: 7 },
    { lead_time: '14 Days', lead_time_value: 14 },
    { lead_time: '21 Days', lead_time_value: 21 },
    { lead_time: '30 Days', lead_time_value: 30 },
    { lead_time: '45 Days', lead_time_value: 45 },
    { lead_time: '60 Days', lead_time_value: 60 },
    { lead_time: '90 Days', lead_time_value: 90 },
  ])

  // Account Performance KPIs
  await seedTable('rpt_account_performance_kpi', [
    { kpi: 'Total Sales', sort_order: 1 },
    { kpi: 'Total Orders', sort_order: 2 },
    { kpi: 'Total Spend', sort_order: 3 },
    { kpi: 'ACOS', sort_order: 4 },
    { kpi: 'TACOS', sort_order: 5 },
    { kpi: 'ROAS', sort_order: 6 },
  ])

  // Toggle tables (default: show = true)
  await seedTable('rpt_toggle_acos', [{ show: true }])
  await seedTable('rpt_toggle_tacos', [{ show: true }])
  await seedTable('rpt_toggle_sales', [{ show: true }])
  await seedTable('rpt_toggle_spend', [{ show: true }])
  await seedTable('rpt_toggle_cvr', [{ show: true }])

  // All Metrics tables
  await seedTable('rpt_all_metrics_sns', [
    { metric: 'Active Subscriptions' },
  ])

  await seedTable('rpt_all_metrics_inventory', [
    { metric: 'Available Units' },
  ])

  await seedTable('rpt_all_metrics_settlement', [
    { metric: 'Inverse Revenue' },
  ])

  await seedTable('rpt_all_metrics_match', [
    { metric: 'PPC Clicks (Match)' },
  ])

  await seedTable('rpt_all_metrics_sales', [
    { metric: 'ACOS' },
    { metric: 'Business Buyer Sales' },
    { metric: 'CPC' },
    { metric: 'CTR' },
    { metric: 'Data_ACOS' },
    { metric: 'Non Business Buyer Sales' },
    { metric: 'Organic Sales' },
    { metric: 'PPC Conversion Rate' },
    { metric: 'PPC Sales % Total Sales' },
  ])

  await seedTable('rpt_all_metrics_ppc', [
    { metric: 'Comparison PPC Sales' },
  ])

  await seedTable('rpt_all_metrics_dashboard', [
    { metric: 'Accounts Performance Values' },
  ])

  console.log('\nDone! All config tables seeded.')
}

seedConfigTables().catch((error: unknown) => {
  console.error('Seed failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
