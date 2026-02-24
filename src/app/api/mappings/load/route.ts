import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/api-auth'
import { LoadMappingResponse } from '@/types/enrichment'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api:mappings:load')

// Use singleton Supabase client
const supabase = getAdminClient()

// GET - Load field mappings (admin only)
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requirePermission('data-enrichment:read')
  if (!auth.authenticated) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const spreadsheetId = searchParams.get('spreadsheet_id')
    const dataSourceId = searchParams.get('data_source_id')

    if (!spreadsheetId && !dataSourceId) {
      return NextResponse.json(
        { error: 'Either spreadsheet_id or data_source_id is required' },
        { status: 400 }
      )
    }

    // Find the data source — select('*') intentional: all columns spread into LoadMappingResponse.dataSource
    let query = supabase.from('data_sources').select('*')

    if (dataSourceId) {
      query = query.eq('id', dataSourceId)
    } else {
      query = query.eq('spreadsheet_id', spreadsheetId)
    }

    const { data: dataSource, error: sourceError } = await query.single()

    if (sourceError || !dataSource) {
      return NextResponse.json(
        { error: 'Data source not found', found: false },
        { status: 404 }
      )
    }

    // Load tab mappings with their column mappings and patterns
    // select('*') intentional: all columns spread into LoadMappingResponse.tabMappings via ...tab
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
          // select('*') intentional: all columns spread into LoadMappingResponse columnMappings arrays
          supabase
            .from('column_mappings')
            .select('*')
            .in('tab_mapping_id', tabIds)
            .order('source_column_index'),
          // select('*') intentional: all columns spread into LoadMappingResponse patterns arrays
          supabase
            .from('column_patterns')
            .select('*')
            .in('tab_mapping_id', tabIds)
            .eq('is_active', true)
            .order('priority', { ascending: false }),
        ])
      : [{ data: [] }, { data: [] }]

    // Build O(1) lookup maps
    const mappingRows = allMappingsResult.data || []
    const mappingsByTab = new Map<string, typeof mappingRows>()
    for (const m of mappingRows) {
      const list = mappingsByTab.get(m.tab_mapping_id)
      if (list) list.push(m)
      else mappingsByTab.set(m.tab_mapping_id, [m])
    }

    const patternRows = allPatternsResult.data || []
    const patternsByTab = new Map<string, typeof patternRows>()
    for (const p of patternRows) {
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

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    })
  } catch (error) {
    logger.error('Error loading mapping', error)
    return NextResponse.json(
      { error: 'Failed to load mapping' },
      { status: 500 }
    )
  }
}
