import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/api-auth'
import { apiSuccess, apiError, ApiErrors, ErrorCodes } from '@/lib/api/response'
import { LoadMappingResponse } from '@/types/enrichment'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:mappings:load')

// GET - Load field mappings (admin only)
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requirePermission('data-enrichment:read')
  if (!auth.authenticated) return auth.response

  const supabase = getAdminClient()

  try {
    const { searchParams } = new URL(request.url)
    const spreadsheetId = searchParams.get('spreadsheet_id')
    const dataSourceId = searchParams.get('data_source_id')

    if (!spreadsheetId && !dataSourceId) {
      return apiError(ErrorCodes.VALIDATION_ERROR, 'Either spreadsheet_id or data_source_id is required', 400)
    }

    // Find the data source
    let query = supabase.from('data_sources').select('*')

    if (dataSourceId) {
      query = query.eq('id', dataSourceId)
    } else {
      query = query.eq('spreadsheet_id', spreadsheetId)
    }

    const { data: dataSource, error: sourceError } = await query.single()

    if (sourceError || !dataSource) {
      return apiError(ErrorCodes.NOT_FOUND, 'Data source not found', 404)
    }

    // Load tab mappings with their column mappings and patterns
    const { data: tabMappings, error: tabError } = await supabase
      .from('tab_mappings')
      .select('*')
      .eq('data_source_id', dataSource.id)
      .eq('is_active', true)
      .order('tab_name')

    if (tabError) throw tabError

    // Batch fetch all column mappings and patterns in 2 queries (not N*2)
    const tabIds = (tabMappings || []).map(t => t.id)

    const [allMappingsResult, allPatternsResult] = tabIds.length > 0
      ? await Promise.all([
          supabase
            .from('column_mappings')
            .select('*')
            .in('tab_mapping_id', tabIds)
            .order('source_column_index'),
          supabase
            .from('column_patterns')
            .select('*')
            .in('tab_mapping_id', tabIds)
            .eq('is_active', true)
            .order('priority', { ascending: false }),
        ])
      : [{ data: [] }, { data: [] }]

    // Build O(1) lookup maps
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mappingsByTab = new Map<string, any[]>()
    for (const m of allMappingsResult.data || []) {
      const list = mappingsByTab.get(m.tab_mapping_id)
      if (list) list.push(m)
      else mappingsByTab.set(m.tab_mapping_id, [m])
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patternsByTab = new Map<string, any[]>()
    for (const p of allPatternsResult.data || []) {
      const list = patternsByTab.get(p.tab_mapping_id)
      if (list) list.push(p)
      else patternsByTab.set(p.tab_mapping_id, [p])
    }

    const tabsWithDetails = (tabMappings || []).map(tab => ({
      ...tab,
      columnMappings: mappingsByTab.get(tab.id) || [],
      patterns: patternsByTab.get(tab.id) || [],
    }))

    const response: LoadMappingResponse = {
      dataSource,
      tabMappings: tabsWithDetails,
    }

    return apiSuccess(response, 200, {
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
    })
  } catch (error: unknown) {
    log.error('Error loading mapping', error)
    return ApiErrors.database(error instanceof Error ? error.message : 'Unknown error')
  }
}
