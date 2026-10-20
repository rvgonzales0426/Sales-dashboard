import type { CellGrid } from './grid'
import type { Issue } from './types'

/* ---------------------------------------------------------------------------
 * HEADER MAP
 *
 * Columns are found by what their merged header block SAYS, never by letter.
 * Each column's header path is read top to bottom through the merges:
 *
 *   E: OCTOBER › SALES COLLECTION › IN HOUSE      → month 10, inhouse
 *   H: OCTOBER › CALLS › CALLS  (H4:H5 merged)    → month 10, calls
 *   U: TARGETS › SALES COLLECTION › IN HOUSE      → targets, inhouse
 *
 * so next quarter's file can reorder columns, add a person, or start lower on
 * the sheet and still import.
 * ------------------------------------------------------------------------- */

export type Metric = 'inhouse' | 'ethical' | 'combi' | 'calls'

export interface MetricColumns {
  inhouse?: number
  ethical?: number
  combi?: number
  calls?: number
}

export interface MonthColumns extends MetricColumns {
  calendarMonth: number
  label: string
}

export interface HeaderMap {
  headerRow: number
  dataStartRow: number
  lastName: number
  firstName: number
  position: number
  area: number
  /** In calendar order. Exactly three when the map is usable. */
  months: MonthColumns[]
  quarterTotal: MetricColumns | null
  targets: MetricColumns | null
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

const MONTH_LOOKUP: Record<string, number> = {}
MONTH_NAMES.forEach((name, index) => {
  const upper = name.toUpperCase()
  MONTH_LOOKUP[upper] = index + 1
  MONTH_LOOKUP[upper.slice(0, 3)] = index + 1
})
MONTH_LOOKUP.SEPT = 9

/** Uppercase, punctuation to spaces, single-spaced: "In-House " → "IN HOUSE". */
export function normalizeHeader(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

const IDENTITY: Record<string, 'lastName' | 'firstName' | 'position' | 'area'> = {
  'LAST NAME': 'lastName',
  LASTNAME: 'lastName',
  SURNAME: 'lastName',
  'FAMILY NAME': 'lastName',
  'FIRST NAME': 'firstName',
  FIRSTNAME: 'firstName',
  'GIVEN NAME': 'firstName',
  POSITION: 'position',
  DESIGNATION: 'position',
  ROLE: 'position',
  AREA: 'area',
  TERRITORY: 'area',
  REGION: 'area',
}

const METRICS: Record<string, Metric> = {
  'IN HOUSE': 'inhouse',
  INHOUSE: 'inhouse',
  ETHICAL: 'ethical',
  ETHICALS: 'ethical',
  COMBI: 'combi',
  COMBINED: 'combi',
  CALLS: 'calls',
  CALL: 'calls',
}

const SUBGROUPS = new Set(['SALES COLLECTION', 'SALES COLLECTIONS', 'COLLECTION', 'COLLECTIONS', 'SALES'])

type Group = { kind: 'month'; month: number } | { kind: 'quarterTotal' } | { kind: 'targets' }

export function monthFromHeader(text: string): number | null {
  const word = normalizeHeader(text).replace(/\d+/g, '').trim()
  return MONTH_LOOKUP[word] ?? null
}

function groupOf(token: string): Group | null {
  const month = monthFromHeader(token)
  if (month) return { kind: 'month', month }
  if (/^(QUARTER|QTR|Q)( TOTALS?)?$/.test(token) || token === 'QUARTER TOTAL' || token === 'TOTAL') {
    return { kind: 'quarterTotal' }
  }
  if (/^(TARGETS?|QUOTAS?)$/.test(token)) return { kind: 'targets' }
  return null
}

const isHeaderWord = (token: string): boolean =>
  token in IDENTITY || token in METRICS || SUBGROUPS.has(token) || groupOf(token) !== null

/** The first row (within the first 50) that has a LAST NAME header. */
export function findHeaderRow(grid: CellGrid): number | null {
  const maxRow = Math.min(grid.rowCount, 50)
  const maxCol = Math.min(grid.colCount, 60)
  for (let r = 1; r <= maxRow; r++) {
    for (let c = 1; c <= maxCol; c++) {
      if (IDENTITY[normalizeHeader(grid.headerText(r, c))] === 'lastName') return r
    }
  }
  return null
}

const metricLabel: Record<Metric, string> = {
  inhouse: 'IN HOUSE',
  ethical: 'ETHICAL',
  combi: 'COMBI',
  calls: 'CALLS',
}

export function buildHeaderMap(grid: CellGrid, headerRow: number): { map: HeaderMap | null; issues: Issue[] } {
  const issues: Issue[] = []
  const lastHeaderRow = Math.min(headerRow + 2, grid.rowCount)

  // Header depth: the lowest of the three rows that still holds header words.
  let depthRow = headerRow
  for (let r = headerRow; r <= lastHeaderRow; r++) {
    for (let c = 1; c <= grid.colCount; c++) {
      if (isHeaderWord(normalizeHeader(grid.headerText(r, c)))) {
        depthRow = r
        break
      }
    }
  }

  const identity: Partial<Record<'lastName' | 'firstName' | 'position' | 'area', number>> = {}
  const months = new Map<number, MonthColumns>()
  let quarterTotal: MetricColumns | null = null
  let targets: MetricColumns | null = null

  for (let c = 1; c <= grid.colCount; c++) {
    const path: string[] = []
    for (let r = headerRow; r <= depthRow; r++) {
      const token = normalizeHeader(grid.headerText(r, c))
      if (token && path[path.length - 1] !== token) path.push(token)
    }
    if (!path.length) continue

    const id = path.map((token) => IDENTITY[token]).find(Boolean)
    if (id) {
      if (identity[id] === undefined) identity[id] = c
      continue
    }

    const group = path.map(groupOf).find(Boolean) ?? null
    const metric = path.map((token) => METRICS[token]).find(Boolean)
    if (!group || !metric) continue

    let bucket: MetricColumns
    let where: string
    if (group.kind === 'month') {
      const existing = months.get(group.month)
      bucket = existing ?? { calendarMonth: group.month, label: MONTH_NAMES[group.month - 1] }
      if (!existing) months.set(group.month, bucket as MonthColumns)
      where = MONTH_NAMES[group.month - 1].toUpperCase()
    } else if (group.kind === 'quarterTotal') {
      bucket = quarterTotal ??= {}
      where = 'QUARTER TOTAL'
    } else {
      bucket = targets ??= {}
      where = 'TARGETS'
    }

    if (bucket[metric] !== undefined) {
      issues.push({
        severity: 'error',
        code: 'header_duplicate',
        message: `There are two ${metricLabel[metric]} columns under ${where}. Delete or rename one of them.`,
        row: headerRow,
      })
      continue
    }
    bucket[metric] = c
  }

  const identityLabels = { lastName: 'LAST NAME', firstName: 'FIRST NAME', position: 'POSITION', area: 'AREA' }
  for (const key of ['lastName', 'firstName', 'position', 'area'] as const) {
    if (identity[key] === undefined) {
      issues.push({
        severity: 'error',
        code: 'header_missing',
        message: `No ${identityLabels[key]} column in the header (row ${headerRow}). Add it back with that exact heading.`,
        row: headerRow,
      })
    }
  }

  const monthList = [...months.values()].sort((a, b) => a.calendarMonth - b.calendarMonth)
  if (monthList.length === 0) {
    issues.push({
      severity: 'error',
      code: 'header_missing',
      message: `No month columns found. Row ${headerRow} needs the quarter's three month names, for example OCTOBER, NOVEMBER, DECEMBER.`,
      row: headerRow,
    })
  } else {
    const quarters = new Set(monthList.map((m) => Math.ceil(m.calendarMonth / 3)))
    if (monthList.length !== 3 || quarters.size !== 1) {
      const found = monthList.map((m) => m.label.toUpperCase()).join(', ')
      issues.push({
        severity: 'error',
        code: monthList.length === 3 ? 'period_conflict' : 'header_missing',
        message: `The month headers are ${found}. A quarter needs exactly three months in a row, such as OCTOBER, NOVEMBER, DECEMBER.`,
        row: headerRow,
      })
    }
  }

  for (const month of monthList) {
    for (const metric of ['inhouse', 'ethical', 'calls'] as const) {
      if (month[metric] === undefined) {
        issues.push({
          severity: 'error',
          code: 'header_missing',
          message: `No ${metricLabel[metric]} column under ${month.label.toUpperCase()}. Every month needs IN HOUSE, ETHICAL and CALLS.`,
          row: headerRow,
        })
      }
    }
  }

  if (!targets) {
    issues.push({
      severity: 'warning',
      code: 'targets_missing',
      message: 'This workbook has no TARGETS columns. Targets will come from the Targets screen instead.',
      row: headerRow,
    })
  } else {
    const missing = (['inhouse', 'ethical', 'combi', 'calls'] as const).filter((m) => targets?.[m] === undefined)
    if (missing.length) {
      issues.push({
        severity: 'warning',
        code: 'targets_missing',
        message: `No ${missing.map((m) => metricLabel[m]).join(', ')} column under TARGETS. Those targets will come from the Targets screen.`,
        row: headerRow,
      })
    }
  }

  const usable = !issues.some((issue) => issue.severity === 'error')
  if (!usable) return { map: null, issues }

  return {
    map: {
      headerRow,
      dataStartRow: depthRow + 1,
      lastName: identity.lastName!,
      firstName: identity.firstName!,
      position: identity.position!,
      area: identity.area!,
      months: monthList,
      quarterTotal,
      targets,
    },
    issues,
  }
}
