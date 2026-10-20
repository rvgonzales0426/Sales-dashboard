import type { Cell } from './grid'
import type { Issue } from './types'

/* ---------------------------------------------------------------------------
 * Reading one INPUT cell as a number.
 *
 * Blank is zero. A typed number is itself. Anything else is either recovered
 * with a warning ("1,234.50" typed as text) or refused with an error that says
 * what to type instead. Formulas in input cells are allowed — the workbook's
 * targets are =SUM(U6) chains — and their cached result is used.
 * ------------------------------------------------------------------------- */

export interface NumberRead {
  value: number
  /** The cell held something, even a typed 0. Blank cells are not present. */
  present: boolean
  /** Problem with the cell itself (text, error value). */
  issue?: Pick<Issue, 'severity' | 'code' | 'message'>
  /** It was a formula; its cached result was used. */
  fromFormula: boolean
  /** A formula whose result was not saved (or was 0 — exceljs can't tell). */
  formulaWithoutResult: boolean
}

const BLANK: NumberRead = { value: 0, present: false, fromFormula: false, formulaWithoutResult: false }

/** "₱1,234.50", "(1,234.50)", "PHP 1234", "-500" → number; anything else → null. */
export function parseNumericText(raw: string): number | null {
  let text = raw.trim()
  if (!text) return null
  let negative = false
  if (/^\(.*\)$/.test(text)) {
    negative = true
    text = text.slice(1, -1)
  }
  text = text.replace(/^(₱|php|p(?=\s*[\d.]))\s*/i, '')
  if (text.startsWith('-') || text.startsWith('−')) {
    negative = !negative
    text = text.slice(1)
  }
  text = text.replace(/[,\s]/g, '').replace(/^(₱|php)/i, '')
  if (!/^\d*\.?\d+$/.test(text)) return null
  const value = Number(text)
  return Number.isFinite(value) ? (negative ? -value : value) : null
}

/** Accounting sheets print zero as a dash. */
const ZERO_DASH = /^[-–—]$/

export function readNumberCell(cell: Cell, ref: string): NumberRead {
  let fromFormula = false
  let shown = cell
  if (cell.kind === 'formula') {
    fromFormula = true
    shown = cell.result
    if (shown.kind === 'empty') {
      return { value: 0, present: true, fromFormula, formulaWithoutResult: true }
    }
  }

  switch (shown.kind) {
    case 'empty':
      return BLANK
    case 'number':
      return { value: shown.value, present: true, fromFormula, formulaWithoutResult: false }
    case 'text': {
      const text = shown.value.trim()
      if (!text) return BLANK
      if (ZERO_DASH.test(text)) return { ...BLANK, present: true, fromFormula }
      const parsed = parseNumericText(text)
      if (parsed !== null) {
        return {
          value: parsed,
          present: true,
          fromFormula,
          formulaWithoutResult: false,
          issue: {
            severity: 'warning',
            code: 'text_number',
            message: `${ref} holds “${text}” as text; it was read as ${parsed.toLocaleString('en-PH')}. Format the cell as a number to silence this.`,
          },
        }
      }
      return {
        ...BLANK,
        present: true,
        fromFormula,
        issue: {
          severity: 'error',
          code: 'non_numeric',
          message: `${ref} holds “${text}”, which is not a number. Type the amount, or leave the cell blank for zero.`,
        },
      }
    }
    case 'error':
      return {
        ...BLANK,
        present: true,
        fromFormula,
        issue: {
          severity: 'error',
          code: 'error_cell',
          message: `${ref} shows ${shown.value}. Fix the formula or type the number directly.`,
        },
      }
    case 'bool':
    case 'date':
      return {
        ...BLANK,
        present: true,
        fromFormula,
        issue: {
          severity: 'error',
          code: 'non_numeric',
          message: `${ref} holds a ${shown.kind === 'date' ? 'date' : 'TRUE/FALSE value'}, not a number. Type the amount instead.`,
        },
      }
  }
  return BLANK
}

/** Rows [7,8,9,10,12] in column U → "U7:U10, U12". */
export function compressRefs(column: string, rows: number[]): string {
  const sorted = [...new Set(rows)].sort((a, b) => a - b)
  const parts: string[] = []
  let start = sorted[0]
  let prev = sorted[0]
  for (let i = 1; i <= sorted.length; i++) {
    const row = sorted[i]
    if (row === prev + 1) {
      prev = row
      continue
    }
    parts.push(start === prev ? `${column}${start}` : `${column}${start}:${column}${prev}`)
    start = row
    prev = row
  }
  return parts.join(', ')
}
