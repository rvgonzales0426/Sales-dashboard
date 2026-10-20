import type { Quarter } from '@/types/sales'
import type { CellGrid } from './grid'
import { normalizeHeader } from './headers'
import type { Issue } from './types'

/* ---------------------------------------------------------------------------
 * PERIOD
 *
 * The quarter comes from two places that must agree: the label beside
 * "QUARTER ENDING" (B2 = FOURTH) and the month headers. The YEAR is not in the
 * sheet, so the upload step asks for it, pre-filled by suggestYear().
 * ------------------------------------------------------------------------- */

const ORDINALS: Record<string, Quarter> = {
  FIRST: 1, '1ST': 1, Q1: 1, ONE: 1, '1': 1,
  SECOND: 2, '2ND': 2, Q2: 2, TWO: 2, '2': 2,
  THIRD: 3, '3RD': 3, Q3: 3, THREE: 3, '3': 3,
  FOURTH: 4, '4TH': 4, Q4: 4, FOUR: 4, '4': 4,
}

export const QUARTER_WORDS: Record<Quarter, string> = { 1: 'FIRST', 2: 'SECOND', 3: 'THIRD', 4: 'FOURTH' }

export function quarterFromLabel(text: string): Quarter | null {
  const words = normalizeHeader(text).split(' ')
  for (const word of words) {
    if (word in ORDINALS) return ORDINALS[word]
  }
  return null
}

export function quarterOfMonth(calendarMonth: number): Quarter {
  return Math.ceil(calendarMonth / 3) as Quarter
}

export function calendarMonthsOf(quarter: Quarter): [number, number, number] {
  const first = quarter * 3 - 2
  return [first, first + 1, first + 2]
}

interface LabelSearch {
  label: string | null
  quarter: Quarter | null
  yearInSheet: number | null
}

/**
 * Looks above the header row for "QUARTER ENDING" and reads the quarter word
 * from the same cell ("QUARTER ENDING: FOURTH") or the next filled cell to the
 * right (B2). Also notices a year if someone typed one into the title.
 */
export function findQuarterLabel(grid: CellGrid, headerRow: number): LabelSearch {
  let label: string | null = null
  let quarter: Quarter | null = null
  let yearInSheet: number | null = null

  for (let r = 1; r < headerRow; r++) {
    for (let c = 1; c <= grid.colCount; c++) {
      const text = grid.headerText(r, c)
      const normalized = normalizeHeader(text)
      if (!normalized) continue

      const year = /\b(20\d{2})\b/.exec(normalized)
      if (year && yearInSheet === null) yearInSheet = Number(year[1])

      if (quarter === null && normalized.includes('QUARTER')) {
        const inline = quarterFromLabel(normalized.replace(/QUARTER|ENDING|ENDED/g, ' '))
        if (inline) {
          label = text.trim()
          quarter = inline
          continue
        }
        for (let next = c + 1; next <= grid.colCount; next++) {
          const neighbour = grid.headerText(r, next).trim()
          if (!neighbour) continue
          label = neighbour
          quarter = quarterFromLabel(neighbour)
          break
        }
      }
    }
  }
  return { label, quarter, yearInSheet }
}

/** Today's year and quarter in Asia/Manila, whatever the device clock's zone. */
export function manilaToday(now: Date = new Date()): { year: number; quarter: Quarter; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now)
  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  return { year, month, quarter: quarterOfMonth(month) }
}

/**
 * The current Manila year — unless that quarter has not started yet, in which
 * case the workbook must be last year's (uploading Q4 in January).
 */
export function suggestYear(quarter: Quarter | null, now: Date = new Date()): number {
  const today = manilaToday(now)
  if (quarter !== null && quarter > today.quarter) return today.year - 1
  return today.year
}

export function resolvePeriod(
  grid: CellGrid,
  headerRow: number,
  calendarMonths: number[],
  now: Date,
): { quarter: Quarter | null; label: string | null; suggestedYear: number; issues: Issue[] } {
  const issues: Issue[] = []
  const fromMonths = calendarMonths.length ? quarterOfMonth(calendarMonths[0]) : null
  const found = findQuarterLabel(grid, headerRow)

  let quarter = fromMonths
  if (found.quarter && fromMonths && found.quarter !== fromMonths) {
    issues.push({
      severity: 'error',
      code: 'period_conflict',
      message: `The sheet says QUARTER ENDING ${found.label?.toUpperCase()}, but the month headers are for Q${fromMonths}. Fix whichever is wrong.`,
    })
  } else if (!found.quarter && fromMonths) {
    issues.push({
      severity: 'info',
      code: 'period_from_months',
      message: `No QUARTER ENDING label found; Q${fromMonths} was taken from the month headers.`,
    })
  } else if (found.quarter) {
    quarter = found.quarter
  }

  let suggestedYear = suggestYear(quarter, now)
  if (found.yearInSheet) {
    suggestedYear = found.yearInSheet
    issues.push({
      severity: 'info',
      code: 'year_in_sheet',
      message: `The title mentions ${found.yearInSheet}, so the year is pre-filled with it. Check it before saving.`,
    })
  }

  return { quarter, label: found.label, suggestedYear, issues }
}
