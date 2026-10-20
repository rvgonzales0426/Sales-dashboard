/**
 * A worksheet as plain data. The parser reads this and nothing else, so its
 * rules can be tested with a hand-built grid and the Excel library stays
 * swappable. Rows and columns are 1-based, like Excel.
 */

export type ScalarCell =
  | { kind: 'empty' }
  | { kind: 'number'; value: number }
  | { kind: 'text'; value: string }
  | { kind: 'bool'; value: boolean }
  | { kind: 'date'; value: Date }
  | { kind: 'error'; value: string }

/** A formula keeps its cached result separately. Derived columns never read it. */
export type Cell = ScalarCell | { kind: 'formula'; formula: string; result: ScalarCell }

export interface MergeRange {
  top: number
  left: number
  bottom: number
  right: number
}

export interface CellGrid {
  name: string
  rowCount: number
  colCount: number
  cell(row: number, col: number): Cell
  /** Text for header reading: a cell inside a merge reads as the merge's top-left. */
  headerText(row: number, col: number): string
}

export const EMPTY: ScalarCell = { kind: 'empty' }

/** "E" → 5, "AA" → 27 */
export function columnNumber(letters: string): number {
  let n = 0
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}

/** 5 → "E" */
export function columnLetters(col: number): string {
  let s = ''
  let n = col
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export const address = (row: number, col: number): string => `${columnLetters(col)}${row}`

/** "A3:A5" → { top: 3, left: 1, bottom: 5, right: 1 } */
export function parseRange(range: string): MergeRange | null {
  const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(range.trim())
  if (!match) return null
  const [, c1, r1, c2, r2] = match
  return {
    top: Math.min(Number(r1), Number(r2)),
    bottom: Math.max(Number(r1), Number(r2)),
    left: Math.min(columnNumber(c1), columnNumber(c2)),
    right: Math.max(columnNumber(c1), columnNumber(c2)),
  }
}

/** The value a person sees: a formula's cached result, rich text joined, etc. */
export function displayValue(cell: Cell): ScalarCell {
  return cell.kind === 'formula' ? cell.result : cell
}

export function cellText(cell: Cell): string {
  const shown = displayValue(cell)
  switch (shown.kind) {
    case 'text':
      return shown.value
    case 'number':
      return String(shown.value)
    case 'bool':
      return shown.value ? 'TRUE' : 'FALSE'
    case 'date':
      return shown.value.toISOString().slice(0, 10)
    case 'error':
      return shown.value
    default:
      return ''
  }
}

/**
 * Builds a grid from rows of cells plus merge ranges. Used by the exceljs
 * adapter and directly by tests.
 */
export function createGrid(name: string, rows: Cell[][], merges: MergeRange[] = []): CellGrid {
  const rowCount = rows.length
  const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0)

  const cell = (row: number, col: number): Cell => rows[row - 1]?.[col - 1] ?? EMPTY

  // For each merged cell, the address of the merge's top-left.
  const masterOf = new Map<string, [number, number]>()
  for (const merge of merges) {
    for (let r = merge.top; r <= merge.bottom; r++) {
      for (let c = merge.left; c <= merge.right; c++) {
        masterOf.set(`${r}:${c}`, [merge.top, merge.left])
      }
    }
  }

  const headerText = (row: number, col: number): string => {
    const [r, c] = masterOf.get(`${row}:${col}`) ?? [row, col]
    return cellText(cell(r, c))
  }

  return { name, rowCount, colCount, cell, headerText }
}
