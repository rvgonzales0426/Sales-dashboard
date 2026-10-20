import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import ExcelJS from 'exceljs'
import { parseWorkbook } from '@/lib/excel/parse'
import type { ParseResult } from '@/lib/excel/types'

export const FIXTURE = resolve('tests/fixtures/sample-q4.xlsx')
export const REAL_FIXTURE = resolve('tests/fixtures/private/SALES_DASHBOARD.xlsx')
export const hasRealFixture = existsSync(REAL_FIXTURE)

/** 20 Oct 2026, noon in Manila — the day the brief was written. */
export const NOW = new Date('2026-10-20T04:00:00Z')

export function readBytes(path: string): ArrayBuffer {
  const buf = readFileSync(path)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

export async function parseBytes(bytes: ArrayBuffer, fileName = 'test.xlsx'): Promise<ParseResult> {
  return parseWorkbook(bytes, { fileName, fileSize: bytes.byteLength }, { now: NOW })
}

export async function parseFile(path: string, fileName = 'SALES_DASHBOARD.xlsx'): Promise<ParseResult> {
  return parseBytes(readBytes(path), fileName)
}

/** Load the fixture, let a test edit it, and hand back the saved bytes. */
export async function editFixture(edit: (wb: ExcelJS.Workbook) => void): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(readBytes(FIXTURE))
  edit(workbook)
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer
}

export interface SheetPerson {
  last: unknown
  first: unknown
  position?: unknown
  area?: unknown
  /** [inhouse, ethical, calls] per month; undefined leaves cells blank. */
  months?: ([unknown, unknown, unknown] | undefined)[]
  targets?: [unknown, unknown, unknown, unknown]
}

export interface SheetSpec {
  /** Row the LAST NAME header sits on. The company file uses 3. */
  headerRow?: number
  monthNames?: [string, string, string]
  quarterWord?: string | null
  /** Put TARGETS before the months, and ETHICAL before IN HOUSE. */
  shuffled?: boolean
  omit?: { month: number; metric: 'IN HOUSE' | 'ETHICAL' | 'CALLS' }
  withTargets?: boolean
  totalRow?: boolean
  people: SheetPerson[]
  extraSheets?: string[]
}

/**
 * Builds a workbook shaped like the company's Sheet1 — merged three-row
 * header, months, quarter total, targets — with knobs for the variations the
 * parser must survive.
 */
export async function buildWorkbook(spec: SheetSpec): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  for (const name of spec.extraSheets ?? []) workbook.addWorksheet(name).getCell('A1').value = 'not this one'
  const ws = workbook.addWorksheet('Sheet1')
  const h = spec.headerRow ?? 3
  const months = spec.monthNames ?? ['OCTOBER', 'NOVEMBER', 'DECEMBER']

  ws.getCell(1, 1).value = 'PERFORMANCE ATTAINMENT PER PSR'
  if (spec.quarterWord !== null) {
    ws.getCell(h - 1, 1).value = 'QUARTER ENDING '
    ws.getCell(h - 1, 2).value = spec.quarterWord ?? 'FOURTH'
  }

  ;['LAST NAME', 'FIRST NAME', 'POSITION', 'AREA'].forEach((label, i) => {
    ws.mergeCells(h, i + 1, h + 2, i + 1)
    ws.getCell(h, i + 1).value = label
  })

  type Group = { name: string; kind: 'month' | 'targets'; index?: number }
  const groups: Group[] = months.map((name, index) => ({ name, kind: 'month', index }))
  if (spec.withTargets !== false) {
    if (spec.shuffled) groups.unshift({ name: 'TARGETS', kind: 'targets' })
    else groups.push({ name: 'TARGETS', kind: 'targets' })
  }

  const metricOrder = spec.shuffled ? ['ETHICAL', 'IN HOUSE', 'COMBI'] : ['IN HOUSE', 'ETHICAL', 'COMBI']
  const columnOf: Record<string, number> = {}
  let col = 5
  const omit = spec.omit
  for (const group of groups) {
    const omitted = (metric: string) => group.kind === 'month' && omit?.month === group.index && omit?.metric === metric
    const metrics = metricOrder.filter((m) => !omitted(m))
    const omitCalls = omitted('CALLS')
    const width = metrics.length + (omitCalls ? 0 : 1)
    ws.mergeCells(h, col, h, col + width - 1)
    ws.getCell(h, col).value = group.name
    ws.mergeCells(h + 1, col, h + 1, col + metrics.length - 1)
    ws.getCell(h + 1, col).value = 'SALES COLLECTION'
    metrics.forEach((metric, i) => {
      ws.getCell(h + 2, col + i).value = metric
      columnOf[`${group.name}:${metric}`] = col + i
    })
    if (!omitCalls) {
      ws.mergeCells(h + 1, col + metrics.length, h + 2, col + metrics.length)
      ws.getCell(h + 1, col + metrics.length).value = 'CALLS'
      columnOf[`${group.name}:CALLS`] = col + metrics.length
    }
    col += width
  }

  const setIf = (r: number, c: number | undefined, value: unknown) => {
    if (c !== undefined && value !== undefined) ws.getCell(r, c).value = value as ExcelJS.CellValue
  }

  spec.people.forEach((person, i) => {
    const r = h + 3 + i
    setIf(r, 1, person.last)
    setIf(r, 2, person.first)
    setIf(r, 3, person.position ?? 'PSR')
    setIf(r, 4, person.area ?? 'NORTH')
    months.forEach((name, m) => {
      const values = person.months?.[m]
      if (!values) return
      setIf(r, columnOf[`${name}:IN HOUSE`], values[0])
      setIf(r, columnOf[`${name}:ETHICAL`], values[1])
      setIf(r, columnOf[`${name}:CALLS`], values[2])
    })
    if (person.targets) {
      ;['IN HOUSE', 'ETHICAL', 'COMBI', 'CALLS'].forEach((metric, t) =>
        setIf(r, columnOf[`TARGETS:${metric}`], person.targets![t]),
      )
    }
  })

  if (spec.totalRow !== false) ws.getCell(h + 3 + spec.people.length + 1, 1).value = 'TOTAL'

  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer
}

export const codes = (result: ParseResult, severity?: 'error' | 'warning' | 'info') =>
  result.issues.filter((i) => !severity || i.severity === severity).map((i) => i.code)
