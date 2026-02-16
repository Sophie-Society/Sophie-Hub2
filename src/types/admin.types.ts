/**
 * Admin domain types
 *
 * Types for system settings, status mappings, and admin operations.
 */

// =============================================================================
// System Settings
// =============================================================================

export interface SystemSetting {
  key: string
  value: string | null
  encrypted: boolean
  description: string | null
  updated_at: string | null
  updated_by: string | null
}

export interface MaskedSetting {
  key: string
  is_set: boolean
  masked_value: string | null
  description: string | null
  updated_at: string | null
  updated_by: string | null
}

export interface SettingUpdate {
  value: string
  encrypted?: boolean
  description?: string
}

// =============================================================================
// Status Color Mappings
// =============================================================================

export interface StatusColorMapping {
  id: string
  status_pattern: string
  bucket: string
  priority: number
  is_active: boolean
  is_system_default: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface StatusColorMappingCreate {
  status_pattern: string
  bucket: string
  priority?: number
  is_system_default?: boolean
  is_active?: boolean
  created_by?: string | null
}

export interface StatusColorMappingUpdate {
  status_pattern?: string
  bucket?: string
  priority?: number
  is_active?: boolean
}

// =============================================================================
// Weekly Status Extraction
// =============================================================================

export interface WeeklyStatusCount {
  status: string
  count: number
}

export interface CategorizedStatus extends WeeklyStatusCount {
  bucket: string
  mappingId: string
}

// =============================================================================
// Repair Mappings
// =============================================================================

export interface RepairTabResult {
  tabMappingId: string
  tabName: string
  sheetName: string
  columnsRepaired: number
  columnsTotal: number
  details: string[]
}

export interface BrokenColumnMapping {
  id: string
  source_column: string | null
  source_column_index: number | null
  target_field: string | null
  tab_mapping_id: string
  tab_mapping: {
    id: string
    tab_name: string
    header_row: number
    data_source: { id: string; name: string; spreadsheet_id: string } | null
  } | null
}

export interface BrokenColumnMappingCheck {
  id: string
  source_column: string | null
  source_column_index: number | null
  target_field: string | null
  tab_mapping: {
    tab_name: string
    data_source: { name: string } | null
  } | null
}
