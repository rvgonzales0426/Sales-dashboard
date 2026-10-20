import type { Workbook, Worksheet, CellValue } from 'exceljs'
import { createGrid, EMPTY, parseRange, type Cell, type CellGrid, type MergeRange, type ScalarCell } from './grid'

/**
 * The only file that knows about exceljs. It is loaded on demand, so the
 * library (~1 MB) never ships with the cockpit — only with the Upload page.
 */

export async function loadExcel() {
  const module = await import('exceljs')
  // CJS in Node (default export), UMD bundle in the browser (namespace).
  return (module as unknown as { default?: typeof module }).default ?? module
}

export async function readWorkbook(bytes: ArrayBuffer): Promise<Workbook> {
  const ExcelJS = await loadExcel()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(bytes)
  return workbook
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !(value instanceof Date)
}

function toScalar(value: unknown): ScalarCell {
  if (value === null || value === undefined) return EMPTY
  if (typeof value === 'number') return Number.isFinite(value) ? { kind: 'number', value } : EMPTY
  if (typeof value === 'string') return { kind: 'text', value }
  if (typeof value === 'boolean') return { kind: 'bool', value }
  if (value instanceof Date) return { kind: 'date', value }
  if (isObject(value)) {
    if (typeof value.error === 'string') return { kind: 'error', value: value.error }
    if (Array.isArray(value.richText)) {
      return { kind: 'text', value: value.richText.map((part: { text?: string }) => part.text ?? '').join('') }
    }
    if (typeof value.text === 'string') return { kind: 'text', value: value.text }
  }
  return EMPTY
}

function toCell(value: CellValue): Cell {
  if (isObject(value) && ('formula' in value || 'sharedFormula' in value)) {
    const formula = String((value as { formula?: string }).formula ?? (value as { sharedFormula?: string }).sharedFormula ?? '')
    // exceljs drops a cached result of 0 (the XML has <v>0</v>), so a formula
    // without a result is reported as such and the parser decides.
    return { kind: 'formula', formula, result: toScalar((value as { result?: unknown }).result) }
  }
  return toScalar(value)
}

export function worksheetToGrid(worksheet: Worksheet): CellGrid {
  const merges: MergeRange[] = []
  for (const range of (worksheet.model as { merges?: string[] }).merges ?? []) {
    const parsed = parseRange(range)
    if (parsed) merges.push(parsed)
  }

  const rows: Cell[][] = []
  const rowCount = worksheet.rowCount
  const colCount = worksheet.columnCount
  for (let r = 1; r <= rowCount; r++) {
    const row = worksheet.getRow(r)
    const cells: Cell[] = []
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c)
      // A merge's non-master cells echo the master's value in exceljs. For data
      // that would double-count; headers use the merge map instead.
      cells.push(cell.isMerged && cell.master.address !== cell.address ? EMPTY : toCell(cell.value))
    }
    rows.push(cells)
  }
  return createGrid(worksheet.name, rows, merges)
}

export function workbookGrids(workbook: Workbook): CellGrid[] {
  return workbook.worksheets.map(worksheetToGrid)
}
