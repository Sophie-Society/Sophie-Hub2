/**
 * Admin Service
 *
 * Business logic for admin operations:
 * system settings, status color mappings, repair mappings.
 */

import * as adminRepo from '@/lib/repositories/admin.repository'
import { maskValue } from '@/lib/encryption'
import { getSheetRawRows } from '@/lib/google/sheets'
import { createLogger } from '@/lib/logger'
import type {
  MaskedSetting,
  StatusColorMapping,
  StatusColorMappingCreate,
  WeeklyStatusCount,
  CategorizedStatus,
  RepairTabResult,
} from '@/types/admin.types'

const log = createLogger('service:admin')

// =============================================================================
// System Settings
// =============================================================================

export async function listMaskedSettings(): Promise<MaskedSetting[]> {
  const settings = await adminRepo.findAllSettings()

  return settings.map(setting => ({
    key: setting.key,
    is_set: !!setting.value,
    masked_value: setting.value ? maskValue(setting.value) : null,
    description: setting.description,
    updated_at: setting.updated_at,
    updated_by: setting.updated_by,
  }))
}

export async function getSetting(key: string): Promise<{ key: string; value: string | null } | null> {
  const setting = await adminRepo.findSettingByKey(key)
  if (!setting) return null
  return { key: setting.key, value: setting.value }
}

export async function saveSetting(
  key: string,
  value: string,
  encrypted: boolean,
  updatedBy: string
): Promise<void> {
  await adminRepo.upsertSetting(key, value, encrypted, updatedBy)
}

export async function removeSetting(key: string): Promise<void> {
  await adminRepo.deleteSetting(key)
}

// =============================================================================
// Status Color Mappings
// =============================================================================

export async function listStatusMappings(): Promise<StatusColorMapping[]> {
  return adminRepo.findAllStatusMappings()
}

export async function createStatusMapping(
  input: StatusColorMappingCreate
): Promise<StatusColorMapping> {
  return adminRepo.createStatusMapping(input)
}

export async function updateStatusMapping(
  id: string,
  bucket: string
): Promise<StatusColorMapping> {
  return adminRepo.updateStatusMapping(id, { bucket })
}

export async function removeStatusMapping(id: string): Promise<void> {
  return adminRepo.deleteStatusMapping(id)
}

// =============================================================================
// Weekly Status Extraction
// =============================================================================

const WEEKLY_COLUMN_REGEX = /\d+\/\d+\/\d+[\s\n]+Week/i

/**
 * Extract weekly status counts from partner source_data.
 * Only counts values in columns matching the weekly pattern (e.g., "1/5/26\nWeek 2").
 */
function extractWeeklyStatusCounts(
  partners: Array<{ source_data: Record<string, unknown> | null }>
): Map<string, number> {
  const statusCounts = new Map<string, number>()

  for (const partner of partners) {
    const sourceData = partner.source_data as Record<string, Record<string, Record<string, unknown>>> | null
    if (!sourceData) continue

    for (const connectorData of Object.values(sourceData)) {
      if (typeof connectorData !== 'object' || !connectorData) continue
      for (const tabData of Object.values(connectorData)) {
        if (typeof tabData !== 'object' || !tabData) continue
        for (const [columnName, value] of Object.entries(tabData)) {
          if (!WEEKLY_COLUMN_REGEX.test(columnName)) continue
          if (typeof value === 'string' && value.trim()) {
            const status = value.trim()
            statusCounts.set(status, (statusCounts.get(status) || 0) + 1)
          }
        }
      }
    }
  }

  return statusCounts
}

/**
 * Get unmapped weekly statuses — status values from partner data
 * that don't match any active status color mapping pattern.
 */
export async function getUnmappedWeeklyStatuses(): Promise<{
  unmapped: WeeklyStatusCount[]
  totalUnmappedPartners: number
  uniqueUnmappedStatuses: number
}> {
  const [activeMappings, partners] = await Promise.all([
    adminRepo.findActiveStatusMappings(),
    adminRepo.findPartnerSourceData(200),
  ])

  const patterns = activeMappings.map(m => m.status_pattern.toLowerCase())
  const statusCounts = extractWeeklyStatusCounts(partners)

  const unmapped: WeeklyStatusCount[] = []
  statusCounts.forEach((count, status) => {
    const statusLower = status.toLowerCase()
    const isMatched = patterns.some(pattern => statusLower.includes(pattern))
    if (!isMatched) {
      unmapped.push({ status, count })
    }
  })

  unmapped.sort((a, b) => b.count - a.count)

  return {
    unmapped,
    totalUnmappedPartners: unmapped.reduce((sum, u) => sum + u.count, 0),
    uniqueUnmappedStatuses: unmapped.length,
  }
}

/**
 * Get all weekly statuses categorized by whether they have a mapping or not.
 */
export async function getAllWeeklyStatusesCategorized(): Promise<{
  categorized: CategorizedStatus[]
  uncategorized: WeeklyStatusCount[]
  totalStatuses: number
  totalCategorized: number
  totalUncategorized: number
}> {
  const [activeMappings, partners] = await Promise.all([
    adminRepo.findActiveStatusMappings(),
    adminRepo.findPartnerSourceData(500),
  ])

  const statusToMapping = new Map<string, { id: string; bucket: string }>()
  for (const m of activeMappings) {
    statusToMapping.set(m.status_pattern.toLowerCase(), { id: m.id, bucket: m.bucket })
  }

  const statusCounts = extractWeeklyStatusCounts(partners)

  const categorized: CategorizedStatus[] = []
  const uncategorized: WeeklyStatusCount[] = []

  statusCounts.forEach((count, status) => {
    const mapping = statusToMapping.get(status.toLowerCase())
    if (mapping) {
      categorized.push({ status, count, bucket: mapping.bucket, mappingId: mapping.id })
    } else {
      uncategorized.push({ status, count })
    }
  })

  categorized.sort((a, b) => b.count - a.count)
  uncategorized.sort((a, b) => b.count - a.count)

  return {
    categorized,
    uncategorized,
    totalStatuses: statusCounts.size,
    totalCategorized: categorized.length,
    totalUncategorized: uncategorized.length,
  }
}

// =============================================================================
// Repair Mappings
// =============================================================================

/**
 * Check how many column/tab mappings need repair (read-only).
 */
export async function checkRepairStatus(): Promise<{
  needsRepair: boolean
  brokenColumnMappings: number
  brokenTabMappings: number
  totalColumnMappings: number
  totalTabMappings: number
  bySheet: Record<string, { tabName: string; count: number; fields: string[] }>
  brokenTabs: Array<{ id: string; tab_name: string | null }>
}> {
  const [brokenMappings, brokenTabs, totalMappings, totalTabs] = await Promise.all([
    adminRepo.findBrokenColumnMappingsForCheck(),
    adminRepo.findBrokenTabMappings(),
    adminRepo.countColumnMappings(),
    adminRepo.countTabMappings(),
  ])

  const bySheet = new Map<string, { tabName: string; count: number; fields: string[] }>()
  for (const mapping of brokenMappings) {
    const tabMapping = mapping.tab_mapping
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

  return {
    needsRepair: brokenMappings.length > 0 || brokenTabs.length > 0,
    brokenColumnMappings: brokenMappings.length,
    brokenTabMappings: brokenTabs.length,
    totalColumnMappings: totalMappings,
    totalTabMappings: totalTabs,
    bySheet: Object.fromEntries(bySheet),
    brokenTabs: brokenTabs.map(t => ({ id: t.id, tab_name: t.tab_name })),
  }
}

/**
 * Repair broken column mappings by fetching actual headers from Google Sheets.
 */
export async function repairMappings(accessToken: string): Promise<{
  message: string
  totalBroken: number
  totalRepaired: number
  results: RepairTabResult[]
}> {
  const brokenMappings = await adminRepo.findBrokenColumnMappings()

  if (brokenMappings.length === 0) {
    const totalMappings = await adminRepo.countColumnMappings()
    return {
      message: 'No broken mappings found',
      totalBroken: 0,
      totalRepaired: 0,
      results: [{
        tabMappingId: '',
        tabName: '',
        sheetName: '',
        columnsRepaired: 0,
        columnsTotal: 0,
        details: [`No broken mappings found (${totalMappings} total)`],
      }],
    }
  }

  log.info(`Found ${brokenMappings.length} mappings with empty source_column`)

  // Group by tab_mapping to minimize sheet fetches
  const byTabMapping = new Map<string, typeof brokenMappings>()
  for (const mapping of brokenMappings) {
    const tabId = mapping.tab_mapping_id
    const existing = byTabMapping.get(tabId) || []
    existing.push(mapping)
    byTabMapping.set(tabId, existing)
  }

  const results: RepairTabResult[] = []
  let totalRepaired = 0

  for (const [tabMappingId, mappings] of Array.from(byTabMapping.entries())) {
    const tabMapping = mappings[0].tab_mapping

    if (!tabMapping?.data_source?.spreadsheet_id) {
      log.info(`Skipping tab ${tabMappingId} - no spreadsheet_id`)
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

    log.info(`Fetching headers for ${sheetName} / ${tabName}`)

    try {
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

        try {
          await adminRepo.updateColumnMappingSourceColumn(mapping.id, header)
          details.push(`Column ${mapping.target_field}: repaired -> "${header}"`)
          repairedCount++
          totalRepaired++
        } catch (updateError: unknown) {
          details.push(`Column ${mapping.target_field}: update failed - ${updateError instanceof Error ? updateError.message : 'Unknown'}`)
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
    } catch (sheetError: unknown) {
      log.error(`Error fetching sheet ${tabName}`, sheetError)
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

  return {
    message: `Repaired ${totalRepaired} column mappings`,
    totalBroken: brokenMappings.length,
    totalRepaired,
    results,
  }
}
