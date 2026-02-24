/**
 * Audit Repository
 *
 * Handles all database operations for the mapping_audit_log table.
 * No business logic — only typed Supabase queries.
 */

import { getAdminClient } from '@/lib/supabase/admin'

const supabase = getAdminClient()

export interface AuditLogInsert {
  user_id: string | null
  user_email: string | null
  action: string
  resource_type: string
  resource_id: string | null
  resource_name: string | null
  changes: Record<string, { old: unknown; new: unknown }> | null
  metadata: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
}

export interface AuditLogFilters {
  action?: string
  resourceType?: string
  resourceId?: string
  userId?: string
}

/**
 * Insert a new audit log entry.
 * Returns the created row id, or throws on error.
 */
export async function insertAuditLog(entry: AuditLogInsert): Promise<string> {
  const { data, error } = await supabase
    .from('mapping_audit_log')
    .insert(entry)
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed to insert audit log: ${error.message}`)
  }

  return (data as { id: string }).id
}

/**
 * Fetch recent audit log entries with optional filters.
 * Returns an empty array on error (audit reads are non-fatal).
 */
export async function findAuditLogs(
  limit: number,
  filters?: AuditLogFilters
): Promise<Record<string, unknown>[]> {
  let query = supabase
    .from('mapping_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (filters?.action) {
    query = query.eq('action', filters.action)
  }
  if (filters?.resourceType) {
    query = query.eq('resource_type', filters.resourceType)
  }
  if (filters?.resourceId) {
    query = query.eq('resource_id', filters.resourceId)
  }
  if (filters?.userId) {
    query = query.eq('user_id', filters.userId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch audit logs: ${error.message}`)
  }

  return (data || []) as Record<string, unknown>[]
}
