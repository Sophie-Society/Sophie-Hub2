/**
 * Settings Repository
 *
 * Handles all database operations for the system_settings table.
 * No business logic — only typed Supabase queries.
 */

import { getAdminClient } from '@/lib/supabase/admin'

const supabase = getAdminClient()

export interface SystemSettingRow {
  value: string
  encrypted: boolean
}

/**
 * Fetch a system setting row by key.
 * Returns null if the key does not exist (PGRST116).
 * Throws on unexpected database errors.
 */
export async function findSystemSetting(key: string): Promise<SystemSettingRow | null> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value, encrypted')
    .eq('key', key)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to fetch system setting "${key}": ${error.message}`)
  }

  return data as SystemSettingRow | null
}
