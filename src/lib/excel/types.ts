import type { Area, Position, Quarter, QuarterMonth } from '@/types/sales'
import type { Centavos } from '@/lib/metrics/money'

/* ---------------------------------------------------------------------------
 * The workbook contract, as data.
 *
 * Severity decides what the preview lets you do:
 *   error   — blocks the commit (unknown area, text in a number cell, …)
 *   warning — shown, saved with the upload, does not block ("no targets")
 *   info    — shown once, not saved ("U7:U13 are formulas; used their results")
 * ------------------------------------------------------------------------- */

export type Severity = 'error' | 'warning' | 'info'

export type IssueCode =
  // The file itself
  | 'file_empty'
  | 'file_too_large'
  | 'file_wrong_type'
  | 'file_encrypted'
  | 'file_legacy_xls'
  | 'file_unreadable'
  // Finding the table
  | 'sheet_not_found'
  | 'sheet_chosen'
  | 'header_missing'
  | 'header_duplicate'
  | 'targets_missing'
  | 'period_conflict'
  | 'period_from_months'
  | 'year_in_sheet'
  // Rows and cells
  | 'no_people'
  | 'missing_name'
  | 'duplicate_person'
  | 'unknown_position'
  | 'unknown_area'
  | 'area_not_applicable'
  | 'non_numeric'
  | 'text_number'
  | 'error_cell'
  | 'formula_input'
  | 'formula_no_result'
  | 'negative_amount'
  | 'negative_calls'
  | 'fractional_calls'
  | 'negative_target'
  | 'no_targets'
  | 'partial_targets'
  | 'combi_target_mismatch'
  | 'cached_mismatch'
  | 'no_month_data'
  | 'rows_after_blank'
  | 'name_cleaned'

export type MoneyField = 'inhouse' | 'ethical'
export type InputField = MoneyField | 'calls'
export type TargetField = 'inhouse' | 'ethical' | 'combi' | 'calls'

export interface Issue {
  severity: Severity
  code: IssueCode
  message: string
  /** 1-based sheet row, when the issue belongs to one. */
  row?: number
  /** A1-style address, or a range like "U7:U13". */
  cell?: string
  /** Lets the preview flag the right cell inline. */
  personKey?: string
  field?: InputField | 'name' | 'position' | 'area' | `target_${TargetField}`
  month?: QuarterMonth
}

export interface ParsedMonth {
  month: QuarterMonth
  inhouse: Centavos
  ethical: Centavos
  calls: number
  /** Any of the three input cells held something, even a typed 0. */
  hasData: boolean
}

export interface ParsedTargets {
  inhouse: Centavos | null
  ethical: Centavos | null
  combi: Centavos | null
  calls: number | null
}

export interface ParsedPerson {
  sourceRow: number
  lastName: string
  firstName: string
  rawLastName: string
  rawFirstName: string
  nameKey: string
  position: Position | null
  rawPosition: string
  area: Area | null
  rawArea: string
  months: [ParsedMonth, ParsedMonth, ParsedMonth]
  targets: ParsedTargets
  /** Cell address of each input, for inline flags: "inhouse:1" → "E6". */
  cells: Record<string, string>
}

export interface ExcludedRow {
  row: number
  label: string
  reason: 'total' | 'subtotal'
}

export interface ParseResult {
  /** Set when the file could not be read at all; everything else is empty. */
  fatal: Issue | null
  fileName: string
  fileSize: number
  sheetName: string | null
  /** Every sheet in the file, so "wrong sheet" errors can list them. */
  sheetNames: string[]
  headerRow: number | null
  quarter: Quarter | null
  /** The text in the QUARTER ENDING cell, e.g. "FOURTH". */
  quarterLabel: string | null
  /** Calendar months of the quarter, e.g. [10, 11, 12]. */
  calendarMonths: [number, number, number] | null
  suggestedYear: number
  monthsWithData: QuarterMonth[]
  people: ParsedPerson[]
  issues: Issue[]
  excluded: ExcludedRow[]
}

export const errorsIn = (result: Pick<ParseResult, 'fatal' | 'issues'>): Issue[] =>
  result.fatal ? [result.fatal] : result.issues.filter((issue) => issue.severity === 'error')

export const canCommit = (result: ParseResult): boolean =>
  !result.fatal && result.people.length > 0 && errorsIn(result).length === 0
