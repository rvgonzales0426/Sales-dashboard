import type { Area, Position, QuarterMonth } from '@/types/sales'
import { formatPeso, toCentavos } from '@/lib/metrics/money'
import { address, cellText, columnLetters, displayValue, type CellGrid } from './grid'
import { compressRefs, readNumberCell, type NumberRead } from './cells'
import { MONTH_NAMES, normalizeHeader, type HeaderMap } from './headers'
import { cleanName, displayName, isCompleteKey, nameKey } from './names'
import type { ExcludedRow, Issue, ParsedMonth, ParsedPerson, ParsedTargets, TargetField } from './types'

/* ---------------------------------------------------------------------------
 * ROWS
 *
 * People run from the first row under the headers to the TOTAL row, which is
 * found by its label and never imported. Without a TOTAL row the table ends at
 * the first blank row.
 *
 * Only INPUT cells are read: in-house, ethical and calls per month, and the
 * four targets. COMBI and QUARTER TOTAL are recomputed, never trusted — the
 * cached values are only compared, to tell the user when the sheet's own
 * formulas disagree with the import.
 * ------------------------------------------------------------------------- */

const TOTAL_LABEL = /^(GRAND )?TOTALS?$/
const SUBTOTAL_LABEL = /^SUB ?TOTALS?\b/

const POSITIONS: Record<string, Position> = {
  PSR: 'psr',
  SUPERVISOR: 'supervisor',
  SUP: 'supervisor',
  SUPV: 'supervisor',
  SPV: 'supervisor',
  GROUPHEAD: 'group_head',
  GH: 'group_head',
  GRPHEAD: 'group_head',
}

const AREAS: Record<string, Area> = { NORTH: 'north', SOUTH: 'south', CARAGA: 'caraga', NA: 'na', NONE: 'na' }

const lettersOnly = (text: string) => normalizeHeader(text).replace(/ /g, '')

/** Collects per-column cell lists so one notice covers "U7:U13", not seven. */
class ColumnNotes {
  private byColumn = new Map<number, number[]>()
  add(col: number, row: number) {
    const rows = this.byColumn.get(col) ?? []
    rows.push(row)
    this.byColumn.set(col, rows)
  }
  entries() {
    return [...this.byColumn.entries()].map(([col, rows]) => compressRefs(columnLetters(col), rows))
  }
  get size() {
    return this.byColumn.size
  }
}

export interface RowsResult {
  people: ParsedPerson[]
  excluded: ExcludedRow[]
  monthsWithData: QuarterMonth[]
  issues: Issue[]
}

export function readPeople(grid: CellGrid, map: HeaderMap): RowsResult {
  const issues: Issue[] = []
  const people: ParsedPerson[] = []
  const excluded: ExcludedRow[] = []
  const formulaInputs = new ColumnNotes()
  const formulasWithoutResult = new ColumnNotes()
  const cachedMismatch: string[] = []
  const combiTargetMismatch: string[] = []
  const firstRowOfKey = new Map<string, number>()

  const identityCols = [map.lastName, map.firstName, map.position, map.area]
  const inputCols = map.months.flatMap((m) => [m.inhouse!, m.ethical!, m.calls!])
  const isBlankRow = (r: number) =>
    [...identityCols, ...inputCols].every((c) => cellText(grid.cell(r, c)).trim() === '')
  const labelOf = (r: number) =>
    normalizeHeader(cellText(grid.cell(r, map.lastName)) || cellText(grid.cell(r, map.firstName)))

  // Where does the table end?
  let totalRow: number | null = null
  for (let r = map.dataStartRow; r <= grid.rowCount; r++) {
    if (TOTAL_LABEL.test(labelOf(r))) {
      totalRow = r
      excluded.push({ row: r, label: cellText(grid.cell(r, map.lastName)).trim() || 'TOTAL', reason: 'total' })
      break
    }
  }
  let lastRow = totalRow ? totalRow - 1 : grid.rowCount
  if (!totalRow) {
    for (let r = map.dataStartRow; r <= grid.rowCount; r++) {
      if (!isBlankRow(r)) continue
      lastRow = r - 1
      const trailing: number[] = []
      for (let after = r + 1; after <= grid.rowCount; after++) if (!isBlankRow(after)) trailing.push(after)
      if (trailing.length) {
        issues.push({
          severity: 'warning',
          code: 'rows_after_blank',
          message: `Row ${r} is blank, so rows ${trailing[0]}–${trailing[trailing.length - 1]} after it were not read. Delete the blank row if they belong to the table, or add a TOTAL row under the last person.`,
          row: r,
        })
      }
      break
    }
  }

  for (let r = map.dataStartRow; r <= lastRow; r++) {
    if (isBlankRow(r)) continue
    if (SUBTOTAL_LABEL.test(labelOf(r))) {
      excluded.push({ row: r, label: cellText(grid.cell(r, map.lastName)).trim(), reason: 'subtotal' })
      continue
    }

    const rawLast = cellText(grid.cell(r, map.lastName))
    const rawFirst = cellText(grid.cell(r, map.firstName))
    const rawPosition = cellText(grid.cell(r, map.position)).trim()
    const rawArea = cellText(grid.cell(r, map.area)).trim()
    const lastName = cleanName(rawLast)
    const firstName = cleanName(rawFirst)
    const key = nameKey(lastName, firstName)
    const who = lastName || firstName ? displayName(lastName || '?', firstName || '?') : `Row ${r}`
    const cells: Record<string, string> = { name: address(r, map.lastName) }
    const note = (issue: Omit<Issue, 'row' | 'personKey'>) => issues.push({ ...issue, row: r, personKey: key })

    if (!lastName || !firstName) {
      note({
        severity: 'error',
        code: 'missing_name',
        field: 'name',
        cell: address(r, lastName ? map.firstName : map.lastName),
        message: lastName || firstName
          ? `Row ${r} has no ${lastName ? 'first' : 'last'} name. Every person needs both.`
          : `Row ${r} has numbers but no name. Add the person's name or delete the row.`,
      })
    }

    // Position
    const position = POSITIONS[lettersOnly(rawPosition)] ?? null
    cells.position = address(r, map.position)
    if (!position) {
      note({
        severity: 'error',
        code: 'unknown_position',
        field: 'position',
        cell: cells.position,
        message: rawPosition
          ? `${who}: position “${rawPosition}” is not PSR, Supervisor or Group head.`
          : `${who}: the position is empty. Use PSR, Supervisor or Group head.`,
      })
    }

    // Area
    cells.area = address(r, map.area)
    let area: Area | null = AREAS[lettersOnly(rawArea)] ?? null
    if (!rawArea && position === 'group_head') area = 'na'
    if (!area) {
      note({
        severity: 'error',
        code: 'unknown_area',
        field: 'area',
        cell: cells.area,
        message: rawArea
          ? `${who}: area “${rawArea}” is not North, South, Caraga or N/A. Fix the spelling, or ask an admin to add the area.`
          : `${who}: the area is empty. Use North, South, Caraga or N/A.`,
      })
    } else if (area === 'na' && position && position !== 'group_head') {
      note({
        severity: 'warning',
        code: 'area_not_applicable',
        field: 'area',
        cell: cells.area,
        message: `${who} has area N/A, so they will not appear in any area's numbers.`,
      })
    }

    const read = (col: number): NumberRead => {
      const ref = address(r, col)
      const result = readNumberCell(grid.cell(r, col), ref)
      if (result.fromFormula && !result.formulaWithoutResult) formulaInputs.add(col, r)
      if (result.formulaWithoutResult) formulasWithoutResult.add(col, r)
      return result
    }

    // Months
    const months = map.months.map((columns, index): ParsedMonth => {
      const month = (index + 1) as QuarterMonth
      const monthName = MONTH_NAMES[columns.calendarMonth - 1]
      const parsed: ParsedMonth = { month, inhouse: 0, ethical: 0, calls: 0, hasData: false }

      for (const field of ['inhouse', 'ethical'] as const) {
        const col = columns[field]!
        const ref = address(r, col)
        cells[`${field}:${month}`] = ref
        const value = read(col)
        if (value.issue) note({ ...value.issue, field, month, cell: ref })
        parsed[field] = toCentavos(value.value)
        parsed.hasData ||= value.present
        if (parsed[field] < 0) {
          note({
            severity: 'warning',
            code: 'negative_amount',
            field,
            month,
            cell: ref,
            message: `${who}: ${monthName} ${field === 'inhouse' ? 'in-house' : 'ethical'} is ${formatPeso(parsed[field])} (${ref}). Imported as a return or adjustment.`,
          })
        }
      }

      const callsCol = columns.calls!
      const callsRef = address(r, callsCol)
      cells[`calls:${month}`] = callsRef
      const calls = read(callsCol)
      if (calls.issue) note({ ...calls.issue, field: 'calls', month, cell: callsRef })
      parsed.hasData ||= calls.present
      if (calls.value < 0) {
        note({ severity: 'error', code: 'negative_calls', field: 'calls', month, cell: callsRef, message: `${who}: ${monthName} calls is ${calls.value} (${callsRef}). Calls cannot be negative.` })
      } else if (!Number.isInteger(calls.value)) {
        note({ severity: 'error', code: 'fractional_calls', field: 'calls', month, cell: callsRef, message: `${who}: ${monthName} calls is ${calls.value} (${callsRef}). Calls must be a whole number.` })
      } else {
        parsed.calls = calls.value
      }

      // Compare the sheet's own COMBI against ours. Ours wins either way.
      if (columns.combi !== undefined) {
        const shown = displayValue(grid.cell(r, columns.combi))
        if (shown.kind === 'number' && toCentavos(shown.value) !== parsed.inhouse + parsed.ethical) {
          cachedMismatch.push(address(r, columns.combi))
        }
      }
      return parsed
    }) as [ParsedMonth, ParsedMonth, ParsedMonth]

    // Targets — blank means "no target", which is not the same as 0.
    const targets: ParsedTargets = { inhouse: null, ethical: null, combi: null, calls: null }
    if (map.targets) {
      for (const field of ['inhouse', 'ethical', 'combi', 'calls'] as TargetField[]) {
        const col = map.targets[field]
        if (col === undefined) continue
        const ref = address(r, col)
        cells[`target_${field}`] = ref
        const value = read(col)
        if (value.issue) note({ ...value.issue, field: `target_${field}`, cell: ref })
        if (!value.present || value.issue?.severity === 'error') continue
        if (value.value < 0) {
          note({ severity: 'error', code: 'negative_target', field: `target_${field}`, cell: ref, message: `${who}: the ${field} target in ${ref} is negative.` })
          continue
        }
        if (field === 'calls') {
          if (!Number.isInteger(value.value)) {
            note({ severity: 'error', code: 'fractional_calls', field: 'target_calls', cell: ref, message: `${who}: the calls target in ${ref} must be a whole number.` })
            continue
          }
          targets.calls = value.value
        } else {
          targets[field] = toCentavos(value.value)
        }
      }

      const set = Object.values(targets).filter((v) => v !== null).length
      if (set === 0) {
        note({
          severity: 'warning',
          code: 'no_targets',
          message: `No targets for ${who}. They are left out of attainment and rankings until targets are set on the Targets screen.`,
        })
      } else if (set < 4) {
        const missing = (Object.keys(targets) as TargetField[]).filter((f) => targets[f] === null)
        note({
          severity: 'warning',
          code: 'partial_targets',
          message: `${who} has no ${missing.join(', ')} target. Set it on the Targets screen, or the attainment for it shows as “—”.`,
        })
      }
      if (targets.combi !== null && targets.inhouse !== null && targets.ethical !== null &&
          targets.combi !== targets.inhouse + targets.ethical) {
        combiTargetMismatch.push(`${formatPeso(targets.combi, { whole: true })}|${formatPeso(targets.inhouse, { whole: true })}|${formatPeso(targets.ethical, { whole: true })}`)
      }
    }

    if (lastName && firstName && isCompleteKey(key)) {
      const first = firstRowOfKey.get(key)
      if (first !== undefined) {
        note({
          severity: 'error',
          code: 'duplicate_person',
          field: 'name',
          cell: cells.name,
          message: `Rows ${first} and ${r} are both ${who}. Each person can only appear once — delete or merge one row.`,
        })
      } else {
        firstRowOfKey.set(key, r)
      }
    }

    people.push({
      sourceRow: r,
      lastName,
      firstName,
      rawLastName: rawLast,
      rawFirstName: rawFirst,
      nameKey: key,
      position,
      rawPosition,
      area,
      rawArea,
      months,
      targets,
      cells,
    })
  }

  // One notice per kind, not one per cell.
  if (formulaInputs.size) {
    issues.push({
      severity: 'info',
      code: 'formula_input',
      cell: formulaInputs.entries().join(', '),
      message: `Input cells ${formulaInputs.entries().join(', ')} hold formulas; their saved results were used.`,
    })
  }
  if (formulasWithoutResult.size) {
    issues.push({
      severity: 'warning',
      code: 'formula_no_result',
      cell: formulasWithoutResult.entries().join(', '),
      message: `Input cells ${formulasWithoutResult.entries().join(', ')} hold formulas with no saved result (or a result of 0) and were read as 0. If they should have values, open the file in Excel, save it, and upload again.`,
    })
  }
  if (cachedMismatch.length) {
    issues.push({
      severity: 'info',
      code: 'cached_mismatch',
      cell: cachedMismatch.join(', '),
      message: `The workbook's own COMBI in ${cachedMismatch.join(', ')} does not equal IN HOUSE + ETHICAL. The import recomputes combi, so the dashboard uses the correct figure.`,
    })
  }
  if (combiTargetMismatch.length) {
    const [combi, inhouse, ethical] = combiTargetMismatch[0].split('|')
    const same = combiTargetMismatch.every((entry) => entry === combiTargetMismatch[0])
    issues.push({
      severity: 'warning',
      code: 'combi_target_mismatch',
      message: same
        ? `For ${combiTargetMismatch.length} ${combiTargetMismatch.length === 1 ? 'person' : 'people'}, the combi target ${combi} is not in-house ${inhouse} + ethical ${ethical}. The combi target is used as written; an admin can change it on the Targets screen.`
        : `For ${combiTargetMismatch.length} people, the combi target is not in-house + ethical. Combi targets are used as written.`,
    })
  }

  const monthsWithData = ([1, 2, 3] as QuarterMonth[]).filter((m) => people.some((p) => p.months[m - 1].hasData))
  if (people.length && monthsWithData.length === 0) {
    issues.push({
      severity: 'warning',
      code: 'no_month_data',
      message: 'None of the three months has any numbers yet. You can still save it to record the roster and targets.',
    })
  }
  if (!people.length) {
    issues.push({
      severity: 'error',
      code: 'no_people',
      message: `No people found under the headers (row ${map.headerRow}). Put one person per row starting at row ${map.dataStartRow}.`,
      row: map.dataStartRow,
    })
  }

  return { people, excluded, monthsWithData, issues }
}
