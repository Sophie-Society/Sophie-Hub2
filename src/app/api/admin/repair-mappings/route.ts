import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { getAdminClient } from '@/lib/supabase/admin'
import { getSheetRawRows } from '@/lib/google/sheets'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { mapSheetsAuthError, resolveSheetsAccessToken } from '@/lib/google/sheets-auth'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:admin:repair-mappings')

const supabase = getAdminClient()

interface RepairResult {
  tabMappingId: string
  tabName: string
  sheetName: string
  columnsRepaired: number
  columnsTotal: number
  details: string[]
}

/**
 * POST /api/admin/repair-mappings
 *
 * Repairs column_mappings that have empty source_column values.
 * Fetches actual headers from Google Sheets and updates the database.
 *
 * This is a one-time fix for data that was saved before proper validation.
 */
export async function POST(): Promise<NextResponse> {
  const auth = await requirePermission('data-enrichment:write')
  if (!auth.authenticated) return auth.response

  const rateLimit = checkRateLimit(auth.user.id, 'admin:repair-mappings:write', RATE_LIMITS.STRICT)
  if (!rateLimit.allowed) {
    return ApiErrors.rateLimited('Too many repair attempts. Please wait before trying again.')
  }

  try {
    // Resolve Google Sheets token (shared connector token when configured,
    // otherwise falls back to the current viewer token).
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return ApiErrors.unauthorized('Not authenticated')
    }

    let accessToken: string
    try {
      const resolved = await resolveSheetsAccessToken(session.accessToken)
      accessToken = resolved.accessToken
    } catch (authError) {
      const mapped = mapSheetsAuthError(authError)
      if (mapped.status === 401) {
        return ApiErrors.unauthorized(mapped.message)
      }
      return ApiErrors.internal(mapped.message)
    }

    // Find all column_mappings with empty or null source_column
    const { data: brokenMappings, error: fetchError } = await supabase
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

    if (fetchError) {
      log.error('Error fetching broken mappings', fetchError)
      return ApiErrors.database(fetchError.message)
    }

    if (!brokenMappings || brokenMappings.length === 0) {
      // Check if there are any mappings at all to verify query is correct
      const { count, error: countError } = await supabase
        .from('column_mappings')
        .select('*', { count: 'exact', head: true })

      if (countError) {
        log.error('Error counting column_mappings', countError)
      }

      return apiSuccess({
        message: 'No broken mappings found',
        totalMappings: count ?? 0,
        repaired: 0,
      })
    }

    log.info(`[repair-mappings] Found ${brokenMappings.length} mappings with empty source_column`)

    // Group by tab_mapping to minimize sheet fetches
    const byTabMapping = new Map<string, typeof brokenMappings>()
    for (const mapping of brokenMappings) {
      const tabId = mapping.tab_mapping_id
      const existing = byTabMapping.get(tabId) || []
      existing.push(mapping)
      byTabMapping.set(tabId, existing)
    }

    const results: RepairResult[] = []
    let totalRepaired = 0

    // Process each tab_mapping
    for (const [tabMappingId, mappings] of Array.from(byTabMapping.entries())) {
      const firstMapping = mappings[0]
      const tabMapping = firstMapping.tab_mapping as unknown as {
        id: string
        tab_name: string
        header_row: number
        data_source: { id: string; name: string; spreadsheet_id: string } | null
      } | null

      if (!tabMapping?.data_source?.spreadsheet_id) {
        log.info(`[repair-mappings] Skipping tab ${tabMappingId} - no spreadsheet_id`)
        results.push({
          tabMappingId,
          tabName: tabMapping?.tab_name || 'Unknown',
          sheetName: tabMapping?.data_source?.name || 'Unknown',
          columnsRepaired: 0,
          columnsTotal: mappings.length,
          details: ['Skipped - no spreadsheet_id found'],
        })
        continue
      }

      const { spreadsheet_id, name: sheetName } = tabMapping.data_source
      const tabName = tabMapping.tab_name
      const headerRow = tabMapping.header_row ?? 0

      log.info(`[repair-mappings] Fetching headers for ${sheetName} / ${tabName}`)

      try {
        // Fetch raw rows from the sheet (need enough rows to get to header row)
        const { rows: rawRows } = await getSheetRawRows(accessToken, spreadsheet_id, tabName, headerRow + 5)

        if (!rawRows || rawRows.length <= headerRow) {
          results.push({
            tabMappingId,
            tabName,
            sheetName,
            columnsRepaired: 0,
            columnsTotal: mappings.length,
            details: ['Could not fetch sheet headers'],
          })
          continue
        }

        const headers = rawRows[headerRow] as string[]
        const details: string[] = []
        let repairedCount = 0

        // Collect batch updates to avoid N+1 sequential queries
        const batchUpdates: { id: string; source_column: string; target_field: string | null }[] = []

        for (const mapping of mappings) {
          const colIndex = mapping.source_column_index
          if (colIndex === null || colIndex === undefined) {
            details.push(`Column ${mapping.target_field}: no source_column_index`)
            continue
          }

          const header = headers[colIndex]
          if (!header) {
            details.push(`Column ${mapping.target_field}: header at index ${colIndex} is empty`)
            continue
          }

          batchUpdates.push({ id: mapping.id, source_column: header, target_field: mapping.target_field })
        }

        // Execute updates in parallel (batched, not sequential N+1)
        const updateResults = await Promise.allSettled(
          batchUpdates.map(({ id, source_column }) =>
            supabase
              .from('column_mappings')
              .update({ source_column })
              .eq('id', id)
              .select('id')
              .single()
          )
        )

        for (let i = 0; i < updateResults.length; i++) {
          const result = updateResults[i]
          const { target_field, source_column } = batchUpdates[i]
          if (result.status === 'fulfilled' && !result.value.error) {
            details.push(`Column ${target_field}: repaired → "${source_column}"`)
            repairedCount++
            totalRepaired++
          } else {
            const errMsg = result.status === 'rejected'
              ? String(result.reason)
              : result.value.error?.message ?? 'Unknown error'
            details.push(`Column ${target_field}: update failed - ${errMsg}`)
          }
        }

        results.push({
          tabMappingId,
          tabName,
          sheetName,
          columnsRepaired: repairedCount,
          columnsTotal: mappings.length,
          details,
        })
      } catch (sheetError) {
        log.error(`[repair-mappings] Error fetching sheet ${tabName}`, sheetError)
        results.push({
          tabMappingId,
          tabName,
          sheetName,
          columnsRepaired: 0,
          columnsTotal: mappings.length,
          details: [`Sheet fetch error: ${sheetError instanceof Error ? sheetError.message : 'Unknown'}`],
        })
      }
    }

    return apiSuccess({
      message: `Repaired ${totalRepaired} column mappings`,
      totalBroken: brokenMappings.length,
      totalRepaired,
      results,
    })
  } catch (error) {
    log.error('[repair-mappings] Error', error)
    return ApiErrors.internal()
  }
}

/**
 * GET /api/admin/repair-mappings
 *
 * Check how many mappings need repair without fixing them.
 */
export async function GET(): Promise<NextResponse> {
  const auth = await requirePermission('data-enrichment:read')
  if (!auth.authenticated) return auth.response

  try {
    // Count mappings with empty source_column
    const { data: brokenMappings, error: fetchError } = await supabase
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

    if (fetchError) {
      return ApiErrors.database(fetchError.message)
    }

    // Also check tab_mappings with empty tab_name
    const { data: brokenTabs, error: tabError } = await supabase
      .from('tab_mappings')
      .select('id, tab_name, data_source_id')
      .or('tab_name.is.null,tab_name.eq.')

    if (tabError) {
      log.error('Error checking tab_mappings', tabError)
    }

    // Get total counts for context
    const { count: totalMappings, error: mappingCountErr } = await supabase
      .from('column_mappings')
      .select('*', { count: 'exact', head: true })

    if (mappingCountErr) {
      log.error('Error counting column_mappings', mappingCountErr)
    }

    const { count: totalTabs, error: tabCountErr } = await supabase
      .from('tab_mappings')
      .select('*', { count: 'exact', head: true })

    if (tabCountErr) {
      log.error('Error counting tab_mappings', tabCountErr)
    }

    // Group broken mappings by sheet for readability
    const bySheet = new Map<string, { tabName: string; count: number; fields: string[] }>()
    for (const mapping of brokenMappings || []) {
      const tabMapping = mapping.tab_mapping as unknown as {
        tab_name: string
        data_source: { name: string } | null
      } | null
      const sheetName = tabMapping?.data_source?.name || 'Unknown'
      const tabName = tabMapping?.tab_name || 'Unknown'
      const key = `${sheetName} / ${tabName}`

      const existing = bySheet.get(key) || { tabName, count: 0, fields: [] }
      existing.count++
      if (mapping.target_field) {
        existing.fields.push(mapping.target_field)
      }
      bySheet.set(key, existing)
    }

    return apiSuccess({
      needsRepair: (brokenMappings?.length || 0) > 0 || (brokenTabs?.length || 0) > 0,
      brokenColumnMappings: brokenMappings?.length || 0,
      brokenTabMappings: brokenTabs?.length || 0,
      totalColumnMappings: totalMappings || 0,
      totalTabMappings: totalTabs || 0,
      bySheet: Object.fromEntries(bySheet),
      brokenTabs: brokenTabs?.map(t => ({ id: t.id, tab_name: t.tab_name })) || [],
    })
  } catch (error) {
    log.error('[repair-mappings] GET error', error)
    return ApiErrors.internal()
  }
}
