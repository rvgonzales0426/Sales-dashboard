import type { Quarter, UploadWarning } from '@/types/sales'
import type { ParseResult } from './types'

/**
 * The JSON commit_upload() expects (supabase/migrations/0006). Money travels
 * as integer centavos; the database divides by 100 into numeric(14,2).
 */
export interface CommitPayload {
  period_year: number
  period_quarter: Quarter
  file_path: string | null
  original_filename: string
  file_sha256: string | null
  file_size: number
  sheet_name: string | null
  months_with_data: number[]
  warnings: UploadWarning[]
  people: {
    name_key: string
    last_name: string
    first_name: string
    position: string
    area: string
    source_row: number
    person_id: string | null
    targets: { inhouse_centavos: number | null; ethical_centavos: number | null; combi_centavos: number | null; calls: number | null }
    months: { month: number; inhouse_centavos: number; ethical_centavos: number; calls: number }[]
  }[]
}

export function buildCommitPayload(
  result: ParseResult,
  input: {
    year: number
    filePath: string | null
    sha256: string | null
    /** name_key → existing person id, from "same person as…" in the preview. */
    matches?: Record<string, string>
  },
): CommitPayload {
  if (!result.quarter) throw new Error('The workbook has no quarter; it cannot be committed.')
  const matches = input.matches ?? {}

  return {
    period_year: input.year,
    period_quarter: result.quarter,
    file_path: input.filePath,
    original_filename: result.fileName,
    file_sha256: input.sha256,
    file_size: result.fileSize,
    sheet_name: result.sheetName,
    months_with_data: result.monthsWithData,
    warnings: result.issues
      .filter((issue) => issue.severity === 'warning')
      .map(({ code, message, row, cell }) => ({ code, message, ...(row ? { row } : {}), ...(cell ? { cell } : {}) })),
    people: result.people.map((person) => ({
      name_key: person.nameKey,
      last_name: person.lastName,
      first_name: person.firstName,
      position: person.position ?? '',
      area: person.area ?? '',
      source_row: person.sourceRow,
      person_id: matches[person.nameKey] ?? null,
      targets: {
        inhouse_centavos: person.targets.inhouse,
        ethical_centavos: person.targets.ethical,
        combi_centavos: person.targets.combi,
        calls: person.targets.calls,
      },
      // Only months that have data anywhere in the file; the rest stay "no data yet".
      months: result.monthsWithData.map((month) => {
        const data = person.months[month - 1]
        return { month, inhouse_centavos: data.inhouse, ethical_centavos: data.ethical, calls: data.calls }
      }),
    })),
  }
}
