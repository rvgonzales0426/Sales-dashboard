import type { Worksheet } from 'exceljs'
import type { Area, Position, Quarter } from '@/types/sales'
import { columnLetters } from './grid'
import { MONTH_NAMES } from './headers'
import { calendarMonthsOf, QUARTER_WORDS } from './period'
import { loadExcel } from './reader'

/* ---------------------------------------------------------------------------
 * The blank template: the same layout as the company's Sheet1, so a filled-in
 * template always imports. Optionally pre-filled with the current roster and
 * targets, leaving only the month figures to type.
 *
 *   A–D   LAST NAME · FIRST NAME · POSITION · AREA
 *   E–P   three months × IN HOUSE · ETHICAL · COMBI · CALLS
 *   Q–T   QUARTER TOTAL (formulas, for the person filling it in)
 *   U–X   TARGETS (quarter figures)
 * ------------------------------------------------------------------------- */

export interface TemplatePerson {
  lastName: string
  firstName: string
  position: Position
  area: Area
  targets?: { inhouse: number | null; ethical: number | null; combi: number | null; calls: number | null }
}

export interface TemplateOptions {
  quarter: Quarter
  roster?: TemplatePerson[]
  /** Empty rows to leave when there is no roster. */
  blankRows?: number
}

const POSITION_TEXT: Record<Position, string> = { psr: 'PSR', supervisor: 'SUPERVISOR', group_head: 'GROUP HEAD' }
const AREA_TEXT: Record<Area, string> = { north: 'NORTH', south: 'SOUTH', caraga: 'CARAGA', na: 'N/A' }

const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE9EAEC' } }
const TARGET_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF4F5F6' } }
const THIN = { style: 'thin' as const, color: { argb: 'FFC9CCD1' } }
const BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN }
const MONEY = '#,##0.00'
const WHOLE = '#,##0'

const FIRST_DATA_ROW = 6

function writeHeaders(sheet: Worksheet, quarter: Quarter) {
  sheet.getCell('A1').value = 'PERFORMANCE ATTAINMENT PER PSR'
  sheet.getCell('A1').font = { bold: true, size: 13 }
  sheet.getCell('A2').value = 'QUARTER ENDING'
  sheet.getCell('B2').value = QUARTER_WORDS[quarter]
  sheet.getCell('A2').font = { bold: true }
  sheet.getCell('B2').font = { bold: true }

  for (const [col, label] of ['LAST NAME', 'FIRST NAME', 'POSITION', 'AREA'].entries()) {
    sheet.mergeCells(3, col + 1, 5, col + 1)
    sheet.getCell(3, col + 1).value = label
  }

  const groups = [
    ...calendarMonthsOf(quarter).map((m) => MONTH_NAMES[m - 1].toUpperCase()),
    'QUARTER TOTAL',
    'TARGETS',
  ]
  groups.forEach((group, index) => {
    const start = 5 + index * 4
    sheet.mergeCells(3, start, 3, start + 3)
    sheet.getCell(3, start).value = group
    sheet.mergeCells(4, start, 4, start + 2)
    sheet.getCell(4, start).value = 'SALES COLLECTION'
    sheet.mergeCells(4, start + 3, 5, start + 3)
    sheet.getCell(4, start + 3).value = 'CALLS'
    sheet.getCell(5, start).value = 'IN HOUSE'
    sheet.getCell(5, start + 1).value = 'ETHICAL'
    sheet.getCell(5, start + 2).value = 'COMBI'
  })

  for (let r = 3; r <= 5; r++) {
    for (let c = 1; c <= 24; c++) {
      const cell = sheet.getCell(r, c)
      cell.font = { bold: true, size: 10 }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.fill = HEADER_FILL
      cell.border = BOX
    }
  }
}

function writePersonRow(sheet: Worksheet, r: number, person: TemplatePerson | null) {
  if (person) {
    sheet.getCell(r, 1).value = person.lastName
    sheet.getCell(r, 2).value = person.firstName
    sheet.getCell(r, 3).value = POSITION_TEXT[person.position]
    sheet.getCell(r, 4).value = AREA_TEXT[person.area]
    const t = person.targets
    if (t) {
      if (t.inhouse !== null) sheet.getCell(r, 21).value = t.inhouse / 100
      if (t.ethical !== null) sheet.getCell(r, 22).value = t.ethical / 100
      if (t.combi !== null) sheet.getCell(r, 23).value = t.combi / 100
      if (t.calls !== null) sheet.getCell(r, 24).value = t.calls
    }
  }

  // Convenience formulas for the person filling it in. The import ignores
  // them and recomputes, so a broken one can't corrupt the dashboard.
  for (const start of [5, 9, 13]) {
    const [ih, eth] = [columnLetters(start), columnLetters(start + 1)]
    sheet.getCell(r, start + 2).value = { formula: `${ih}${r}+${eth}${r}` }
  }
  sheet.getCell(r, 17).value = { formula: `E${r}+I${r}+M${r}` }
  sheet.getCell(r, 18).value = { formula: `F${r}+J${r}+N${r}` }
  sheet.getCell(r, 19).value = { formula: `Q${r}+R${r}` }
  sheet.getCell(r, 20).value = { formula: `H${r}+L${r}+P${r}` }

  for (let c = 1; c <= 24; c++) {
    const cell = sheet.getCell(r, c)
    cell.border = BOX
    if (c >= 5) cell.numFmt = (c - 4) % 4 === 0 ? WHOLE : MONEY
    if (c >= 21) cell.fill = TARGET_FILL
  }

  sheet.getCell(r, 3).dataValidation = {
    type: 'list',
    allowBlank: false,
    formulae: ['"PSR,SUPERVISOR,GROUP HEAD"'],
    showErrorMessage: true,
    errorTitle: 'Position',
    error: 'Choose PSR, SUPERVISOR or GROUP HEAD.',
  }
  sheet.getCell(r, 4).dataValidation = {
    type: 'list',
    allowBlank: false,
    formulae: ['"NORTH,SOUTH,CARAGA,N/A"'],
    showErrorMessage: true,
    errorTitle: 'Area',
    error: 'Choose NORTH, SOUTH, CARAGA or N/A.',
  }
}

function writeInstructions(sheet: Worksheet) {
  const lines = [
    'HOW TO FILL IN THIS WORKBOOK',
    '',
    'One person per row on the PERFORMANCE sheet, starting at row 6. Keep the TOTAL row last.',
    'Type in-house, ethical and calls for each month. Leave a cell blank for zero.',
    'COMBI and QUARTER TOTAL are formulas for your convenience — the dashboard recomputes them.',
    'TARGETS are QUARTER figures (e.g. calls 480 = 160 a month). Leave blank if someone has no target.',
    'Positions: PSR, SUPERVISOR, GROUP HEAD. Areas: NORTH, SOUTH, CARAGA, N/A.',
    'Returns and adjustments may be negative. Calls may not.',
    'Do not rename the header rows (3 to 5). Columns may be reordered; the headers are what count.',
    'Remove any password before uploading, and save as .xlsx.',
  ]
  sheet.getColumn(1).width = 110
  lines.forEach((line, index) => {
    const cell = sheet.getCell(index + 1, 1)
    cell.value = line
    if (index === 0) cell.font = { bold: true, size: 13 }
  })
}

export async function buildTemplate(options: TemplateOptions): Promise<ArrayBuffer> {
  const ExcelJS = await loadExcel()
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Sales Cockpit'
  workbook.title = `Performance workbook template — Q${options.quarter}`

  const sheet = workbook.addWorksheet('PERFORMANCE', {
    views: [{ state: 'frozen', xSplit: 4, ySplit: 5 }],
  })
  writeHeaders(sheet, options.quarter)

  const roster = options.roster ?? []
  const rows: (TemplatePerson | null)[] = roster.length
    ? roster
    : Array.from({ length: options.blankRows ?? 12 }, () => null)
  rows.forEach((person, index) => writePersonRow(sheet, FIRST_DATA_ROW + index, person))

  // Blank spacer row, then TOTAL — the importer stops at the TOTAL label.
  const lastPersonRow = FIRST_DATA_ROW + rows.length - 1
  const totalRow = lastPersonRow + 2
  sheet.getCell(totalRow, 1).value = 'TOTAL'
  sheet.getCell(totalRow, 1).font = { bold: true }
  for (let c = 5; c <= 24; c++) {
    const letter = columnLetters(c)
    const cell = sheet.getCell(totalRow, c)
    cell.value = { formula: `SUM(${letter}${FIRST_DATA_ROW}:${letter}${lastPersonRow})` }
    cell.numFmt = (c - 4) % 4 === 0 ? WHOLE : MONEY
    cell.font = { bold: true }
    cell.border = { top: THIN, bottom: THIN }
  }

  sheet.getColumn(1).width = 18
  sheet.getColumn(2).width = 18
  sheet.getColumn(3).width = 13
  sheet.getColumn(4).width = 10
  for (let c = 5; c <= 24; c++) sheet.getColumn(c).width = (c - 4) % 4 === 0 ? 9 : 14

  writeInstructions(workbook.addWorksheet('HOW TO FILL'))

  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer
}

export function templateFileName(quarter: Quarter, year?: number): string {
  return `performance-template-${year ? `${year}-` : ''}Q${quarter}.xlsx`
}
