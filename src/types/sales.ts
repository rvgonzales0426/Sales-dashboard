/**
 * Row types for the sales tables (supabase/migrations/0003–0006).
 * Hand-written, like database.ts. numeric(14,2) columns arrive from PostgREST
 * as JSON numbers; convert them with toCentavos() before doing arithmetic.
 */

export type Position = 'psr' | 'supervisor' | 'group_head'
export type Area = 'north' | 'south' | 'caraga' | 'na'
/** Month within the quarter: 1 = first month (e.g. October for Q4). */
export type QuarterMonth = 1 | 2 | 3
export type Quarter = 1 | 2 | 3 | 4

export interface Person {
  id: string
  last_name: string
  first_name: string
  name_key: string
  position: Position
  area: Area
  active: boolean
  profile_id: string | null
  merged_into: string | null
  first_seen_upload_id: string | null
  created_at: string
  updated_at: string
}

export type PersonUpdate = Partial<
  Pick<Person, 'last_name' | 'first_name' | 'name_key' | 'position' | 'area' | 'active' | 'profile_id'>
>

export interface UploadWarning {
  code: string
  message: string
  row?: number
  cell?: string
}

export interface Upload {
  id: string
  period_year: number
  period_quarter: Quarter
  version: number
  file_path: string | null
  original_filename: string
  file_sha256: string | null
  file_size: number | null
  sheet_name: string | null
  uploaded_by: string | null
  uploaded_at: string
  status: 'clean' | 'warnings'
  is_current: boolean
  row_count: number
  months_with_data: QuarterMonth[]
  warning_count: number
  warnings: UploadWarning[]
  /** Joined by `select('*, uploader:profiles(full_name, email)')`. */
  uploader?: { full_name: string | null; email: string } | null
}

export interface UploadPerson {
  upload_id: string
  person_id: string
  position: Position
  area: Area
  source_row: number | null
  source_last_name: string
  source_first_name: string
  target_inhouse: number | null
  target_ethical: number | null
  target_combi: number | null
  target_calls: number | null
}

export interface PerformanceRow {
  upload_id: string
  person_id: string
  month: QuarterMonth
  inhouse: number
  ethical: number
  calls: number
}

export type TargetScope = 'person' | 'position_area' | 'position'

export interface TargetRow {
  id: string
  period_year: number
  period_quarter: Quarter
  scope: TargetScope
  person_id: string | null
  position: Position | null
  area: Area | null
  inhouse: number | null
  ethical: number | null
  combi: number | null
  calls: number | null
  note: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type TargetUpsert = Omit<TargetRow, 'id' | 'updated_by' | 'created_at' | 'updated_at'> & {
  id?: string
}

export interface SalesSettings {
  on_pace_threshold: number
  at_risk_threshold: number
  calls_low_threshold: number
  agent_access_enabled: boolean
  combi_target_fallback: 'sum' | 'none'
  file_calls_target_basis: 'quarter' | 'month'
  rank_requires_target: boolean
  wall_rotate_seconds: number
  updated_at?: string
}

export interface AuditEntry {
  id: number
  at: string
  actor_id: string | null
  actor_email: string | null
  action: string
  entity: string
  entity_id: string | null
  summary: string
  details: Record<string, unknown>
}

/** A quarter, as the cockpit addresses it ("2026-Q4" in the URL). */
export interface PeriodKey {
  year: number
  quarter: Quarter
}
