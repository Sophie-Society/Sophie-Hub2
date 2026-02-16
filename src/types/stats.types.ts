/**
 * Stats domain types
 *
 * Types for dashboard statistics and health distribution.
 */

export interface HealthDistribution {
  bucket: string
  count: number
  color: string
}

export interface TableStats {
  table_name: string
  row_count: number
}

export interface DashboardStats {
  activeCount: number
  totalPartners: number
  totalStaff: number
  healthDistribution: HealthDistribution[]
}
