import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:partners:field-lineage')

export interface FieldLineageInfo {
  targetField: string
  sourceColumn: string
  tabName: string
  sheetName: string
  dataSourceId: string
}

/**
 * GET /api/partners/field-lineage
 *
 * Returns the mapping lineage for all partner fields.
 * Shows which sheet, tab, and column each field was mapped from.
 */
export async function GET(): Promise<NextResponse> {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  try {
    const supabase = getAdminClient()

    // Query the column mappings with joins to get full lineage
    // Foreign key is tab_mapping_id -> tab_mappings, and data_source_id -> data_sources
    const { data, error } = await supabase
      .from('column_mappings')
      .select(`
        target_field,
        source_column,
        source_column_index,
        tab_mapping:tab_mapping_id (
          tab_name,
          primary_entity,
          is_active,
          data_source:data_source_id (
            id,
            name
          )
        )
      `)
      .not('target_field', 'is', null)

    if (error) {
      log.error('Error fetching field lineage', error)
      return ApiErrors.database()
    }

    // Transform to a clean structure, filtering for partners
    const lineage: Record<string, FieldLineageInfo> = {}

    for (const row of data || []) {
      // Supabase returns nested relations - use unknown first to handle type mismatch
      const tabMappingRaw = row.tab_mapping as unknown as {
        tab_name: string
        primary_entity: string
        is_active: boolean
        data_source: { id: string; name: string } | null
      } | null

      // Get source_column_index for fallback display
      const sourceColumnIndex = (row as { source_column_index?: number }).source_column_index

      // Skip if join failed, not a partner mapping, or tab is inactive
      if (!tabMappingRaw) continue
      if (tabMappingRaw.primary_entity !== 'partners') continue
      if (!tabMappingRaw.is_active) continue // Only show active tab mappings
      if (!row.target_field) continue

      // Use source_column if available, otherwise show column index as fallback
      const sourceColumn = row.source_column && row.source_column.trim() !== ''
        ? row.source_column
        : sourceColumnIndex !== null && sourceColumnIndex !== undefined
          ? `Column ${String.fromCharCode(65 + sourceColumnIndex)}` // A, B, C, etc.
          : 'Unknown'

      lineage[row.target_field] = {
        targetField: row.target_field,
        sourceColumn,
        tabName: tabMappingRaw.tab_name || 'Unknown Tab',
        sheetName: tabMappingRaw.data_source?.name || 'Unknown',
        dataSourceId: tabMappingRaw.data_source?.id || '',
      }
    }

    return apiSuccess({ lineage })
  } catch (error: unknown) {
    log.error('Error in GET /api/partners/field-lineage', error)
    return ApiErrors.internal()
  }
}
