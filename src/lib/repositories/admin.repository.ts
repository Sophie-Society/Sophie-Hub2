/**
 * Admin Repository
 *
 * All Supabase queries for admin operations:
 * system settings, status color mappings, repair mappings.
 */

import { getAdminClient } from '@/lib/supabase/admin'
import type {
  SystemSetting,
  StatusColorMapping,
  StatusColorMappingCreate,
  StatusColorMappingUpdate,
  BrokenColumnMapping,
  BrokenColumnMappingCheck,
} from '@/types/admin.types'

// =============================================================================
// System Settings
// =============================================================================

export async function findAllSettings(): Promise<SystemSetting[]> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('system_settings')
    .select('key, value, encrypted, description, updated_at, updated_by')
    .order('key')

  if (error) throw new Error(`Failed to fetch settings: ${error.message}`)
  return (data || []) as SystemSetting[]
}

export async function findSettingByKey(key: string): Promise<SystemSetting | null> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('system_settings')
    .select('key, value, encrypted, description, updated_at, updated_by')
    .eq('key', key)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch setting: ${error.message}`)
  return data as SystemSetting | null
}

export async function upsertSetting(
  key: string,
  value: string,
  encrypted: boolean,
  updatedBy: string
): Promise<SystemSetting> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('system_settings')
    .upsert({
      key,
      value,
      encrypted,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    }, { onConflict: 'key' })
    .select()
    .single()

  if (error) throw new Error(`Failed to upsert setting: ${error.message}`)
  return data as SystemSetting
}

export async function deleteSetting(key: string): Promise<void> {
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('system_settings')
    .delete()
    .eq('key', key)

  if (error) throw new Error(`Failed to delete setting: ${error.message}`)
}

// =============================================================================
// Status Color Mappings
// =============================================================================

export async function findAllStatusMappings(): Promise<StatusColorMapping[]> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('status_color_mappings')
    .select('*')
    .order('status_pattern')

  if (error) throw new Error(`Failed to fetch status mappings: ${error.message}`)
  return (data || []) as StatusColorMapping[]
}

export async function findActiveStatusMappings(): Promise<StatusColorMapping[]> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('status_color_mappings')
    .select('*')
    .eq('is_active', true)

  if (error) throw new Error(`Failed to fetch active status mappings: ${error.message}`)
  return (data || []) as StatusColorMapping[]
}

export async function findStatusMappingById(id: string): Promise<StatusColorMapping | null> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('status_color_mappings')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch status mapping: ${error.message}`)
  return data as StatusColorMapping | null
}

export async function createStatusMapping(
  mapping: StatusColorMappingCreate
): Promise<StatusColorMapping> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('status_color_mappings')
    .insert(mapping)
    .select()
    .single()

  if (error) throw new Error(`Failed to create status mapping: ${error.message}`)
  return data as StatusColorMapping
}

export async function updateStatusMapping(
  id: string,
  updates: StatusColorMappingUpdate
): Promise<StatusColorMapping> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('status_color_mappings')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Failed to update status mapping: ${error.message}`)
  return data as StatusColorMapping
}

export async function deleteStatusMapping(id: string): Promise<void> {
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('status_color_mappings')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Failed to delete status mapping: ${error.message}`)
}

// =============================================================================
// Partner Source Data (for status extraction)
// =============================================================================

export async function findPartnerSourceData(
  limit?: number
): Promise<Array<{ source_data: Record<string, unknown> | null }>> {
  const supabase = getAdminClient()
  let query = supabase
    .from('partners')
    .select('source_data')
    .not('source_data', 'is', null)
    .order('updated_at', { ascending: false })

  if (limit) {
    query = query.limit(limit)
  }

  const { data, error } = await query
  if (error) throw new Error(`Failed to fetch partner source data: ${error.message}`)
  return (data || []) as Array<{ source_data: Record<string, unknown> | null }>
}

// =============================================================================
// Repair Mappings
// =============================================================================

export async function findBrokenColumnMappings(): Promise<BrokenColumnMapping[]> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('column_mappings')
    .select(`
      id,
      source_column,
      source_column_index,
      target_field,
      tab_mapping_id,
      tab_mapping:tab_mapping_id (
        id,
        tab_name,
        header_row,
        data_source:data_source_id (
          id,
          name,
          spreadsheet_id
        )
      )
    `)
    .or('source_column.is.null,source_column.eq.')

  if (error) throw new Error(`Failed to fetch broken column mappings: ${error.message}`)
  return (data || []) as unknown as BrokenColumnMapping[]
}

export async function findBrokenColumnMappingsForCheck(): Promise<BrokenColumnMappingCheck[]> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('column_mappings')
    .select(`
      id,
      source_column,
      source_column_index,
      target_field,
      tab_mapping:tab_mapping_id (
        tab_name,
        data_source:data_source_id (
          name
        )
      )
    `)
    .or('source_column.is.null,source_column.eq.')

  if (error) throw new Error(`Failed to fetch broken column mappings: ${error.message}`)
  return (data || []) as unknown as BrokenColumnMappingCheck[]
}

export async function findBrokenTabMappings(): Promise<Array<{ id: string; tab_name: string | null }>> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('tab_mappings')
    .select('id, tab_name, data_source_id')
    .or('tab_name.is.null,tab_name.eq.')

  if (error) throw new Error(`Failed to fetch broken tab mappings: ${error.message}`)
  return (data || []) as Array<{ id: string; tab_name: string | null }>
}

export async function countColumnMappings(): Promise<number> {
  const supabase = getAdminClient()
  const { count, error } = await supabase
    .from('column_mappings')
    .select('*', { count: 'exact', head: true })

  if (error) throw new Error(`Failed to count column mappings: ${error.message}`)
  return count || 0
}

export async function countTabMappings(): Promise<number> {
  const supabase = getAdminClient()
  const { count, error } = await supabase
    .from('tab_mappings')
    .select('*', { count: 'exact', head: true })

  if (error) throw new Error(`Failed to count tab mappings: ${error.message}`)
  return count || 0
}

export async function updateColumnMappingSourceColumn(
  id: string,
  sourceColumn: string
): Promise<void> {
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('column_mappings')
    .update({ source_column: sourceColumn })
    .eq('id', id)

  if (error) throw new Error(`Failed to update column mapping: ${error.message}`)
}
