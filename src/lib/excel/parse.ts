import type { CellGrid } from './grid'
import { cellText } from './grid'
import { buildHeaderMap, findHeaderRow, normalizeHeader } from './headers'
import { resolvePeriod, suggestYear } from './period'
import { readWorkbook, workbookGrids } from './reader'
import { readPeople } from './rows'
import { checkFileBytes, checkFileMeta } from './sniff'
import type { Issue, ParseResult } from './types'

/* ---------------------------------------------------------------------------
 * parseWorkbook — the one entry point.
 *
 *   bytes → sniff (encrypted? .xls? empty?) → exceljs → grids
 *         → choose the performance sheet → header map → period → rows
 *
 * Never throws for a bad file. Whatever goes wrong comes back as an Issue the
 * preview can show, worded so the person uploading knows what to fix.
 * ------------------------------------------------------------------------- */

export interface ParseOptions {
  /** Clock for the year suggestion; tests pin it. */
  now?: Date
}

function isEmptyGrid(grid: CellGrid): boolean {
  for (let r = 1; r <= grid.rowCount; r++) {
    for (let c = 1; c <= grid.colCount; c++) {
      if (cellText(grid.cell(r, c)).trim()) return false
    }
  }
  return true
}

function emptyResult(fileName: string, fileSize: number, now: Date): ParseResult {
  return {
    fatal: null,
    fileName,
    fileSize,
    sheetName: null,
    sheetNames: [],
    headerRow: null,
    quarter: null,
    quarterLabel: null,
    calendarMonths: null,
    suggestedYear: suggestYear(null, now),
    monthsWithData: [],
    people: [],
    issues: [],
    excluded: [],
  }
}

/** A result for a file rejected before reading it (too big, empty). */
export function failedResult(meta: { fileName: string; fileSize: number }, fatal: Issue, now = new Date()): ParseResult {
  return { ...emptyResult(meta.fileName, meta.fileSize, now), fatal }
}

/**
 * Several sheets can carry the same headers — the sample's DASHBOARD sheet
 * copies them over LOOKUP formulas. The source sheet is the one whose rows are
 * typed in: score each candidate by people rows with literal (non-formula)
 * names and positions.
 */
function chooseSheet(grids: CellGrid[]): { grid: CellGrid; headerRow: number } | null {
  let best: { grid: CellGrid; headerRow: number; score: number } | null = null
  for (const grid of grids) {
    const headerRow = findHeaderRow(grid)
    if (headerRow === null) continue
    let score = 0
    for (let r = headerRow + 1; r <= grid.rowCount; r++) {
      const a = grid.cell(r, 1)
      const b = grid.cell(r, 2)
      if (a.kind === 'text' && b.kind === 'text' && !/TOTAL/.test(normalizeHeader(a.value))) score++
    }
    // A TARGETS block is the strongest sign of the source sheet.
    for (let c = 1; c <= grid.colCount; c++) {
      if (/^TARGETS?$/.test(normalizeHeader(grid.headerText(headerRow, c)))) {
        score += 100
        break
      }
    }
    if (!best || score > best.score) best = { grid, headerRow, score }
  }
  return best
}

export function parseGrids(
  grids: CellGrid[],
  meta: { fileName: string; fileSize: number },
  options: ParseOptions = {},
): ParseResult {
  const now = options.now ?? new Date()
  const result = emptyResult(meta.fileName, meta.fileSize, now)
  result.sheetNames = grids.map((g) => g.name)

  const chosen = chooseSheet(grids)
  if (!chosen) {
    result.fatal = {
      severity: 'error',
      code: 'sheet_not_found',
      message: `No sheet in this file has the performance table. It needs a header row with LAST NAME, FIRST NAME, POSITION, AREA and the month columns. Sheets found: ${result.sheetNames.join(', ') || 'none'}. Download the blank template to see the expected layout.`,
    }
    return result
  }

  const { grid, headerRow } = chosen
  result.sheetName = grid.name
  result.headerRow = headerRow
  const issues: Issue[] = []

  if (grids.length > 1) {
    const ignored = grids.filter((g) => g !== grid).map((g) => g.name)
    issues.push({
      severity: 'info',
      code: 'sheet_chosen',
      message: `Read the sheet “${grid.name}”. Ignored: ${ignored.join(', ')}.`,
    })
  }

  const { map, issues: headerIssues } = buildHeaderMap(grid, headerRow)
  issues.push(...headerIssues)
  if (!map) {
    result.issues = issues
    return result
  }

  const calendarMonths = map.months.map((m) => m.calendarMonth)
  result.calendarMonths = calendarMonths as [number, number, number]

  const period = resolvePeriod(grid, headerRow, calendarMonths, now)
  result.quarter = period.quarter
  result.quarterLabel = period.label
  result.suggestedYear = period.suggestedYear
  issues.push(...period.issues)

  const rows = readPeople(grid, map)
  result.people = rows.people
  result.excluded = rows.excluded
  result.monthsWithData = rows.monthsWithData
  issues.push(...rows.issues)

  // Errors first, then warnings, then notes; sheet order within each.
  const rank = { error: 0, warning: 1, info: 2 }
  result.issues = issues
    .map((issue, index) => ({ issue, index }))
    .sort((a, b) => rank[a.issue.severity] - rank[b.issue.severity] || (a.issue.row ?? 0) - (b.issue.row ?? 0) || a.index - b.index)
    .map(({ issue }) => issue)
  return result
}

export async function parseWorkbook(
  bytes: ArrayBuffer,
  meta: { fileName: string; fileSize: number },
  options: ParseOptions = {},
): Promise<ParseResult> {
  const now = options.now ?? new Date()
  const result = emptyResult(meta.fileName, meta.fileSize, now)

  const metaProblem = checkFileMeta(meta.fileName, meta.fileSize)
  const byteProblem = checkFileBytes(new Uint8Array(bytes))
  // A password-protected workbook keeps its .xlsx name; say "password", not "wrong type".
  const problem = byteProblem?.code === 'file_encrypted' ? byteProblem : (metaProblem ?? byteProblem)
  if (problem) {
    result.fatal = problem
    return result
  }

  let grids: CellGrid[]
  try {
    grids = workbookGrids(await readWorkbook(bytes))
  } catch {
    result.fatal = {
      severity: 'error',
      code: 'file_unreadable',
      message: 'This workbook could not be opened — it may be damaged. Open it in Excel, save a fresh copy as .xlsx, and upload that.',
    }
    return result
  }

  if (grids.every(isEmptyGrid)) {
    result.sheetNames = grids.map((g) => g.name)
    result.fatal = {
      severity: 'error',
      code: 'file_empty',
      message: 'Every sheet in this workbook is empty. Fill in the performance table, or download the blank template to start from.',
    }
    return result
  }

  return parseGrids(grids, meta, options)
}
