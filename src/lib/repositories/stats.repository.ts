/**
 * Stats Repository
 *
 * All Supabase queries for dashboard statistics.
 */

import { getAdminClient } from '@/lib/supabase/admin'

// =============================================================================
// Health Distribution
// =============================================================================

export async function findPartnersWithSourceData(): Promise<Array<{ source_data: Record<string, unknown> | null; status: string | null }>> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('partners')
    .select('source_data, status')

  if (error) throw new Error(`Failed to fetch partners for health: ${error.message}`)
  return (data || []) as Array<{ source_data: Record<string, unknown> | null; status: string | null }>
}

// =============================================================================
// Table Row Counts
// =============================================================================

export async function countTable(tableName: string): Promise<number> {
  const supabase = getAdminClient()
  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true })

  if (error) throw new Error(`Failed to count ${tableName}: ${error.message}`)
  return count || 0
}

// =============================================================================
// Staff Count
// =============================================================================

export async function countStaff(): Promise<number> {
  const supabase = getAdminClient()
  const { count, error } = await supabase
    .from('staff')
    .select('*', { count: 'exact', head: true })

  if (error) throw new Error(`Failed to count staff: ${error.message}`)
  return count || 0
}
