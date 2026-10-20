import { describe, expect, it } from 'vitest'
import { buildWorkbook, codes, parseBytes, type SheetPerson } from '../helpers/workbooks'

/* The parser is header-driven: next quarter's file may move columns, start
 * lower, or add people, and must still import. It fails only when a required
 * header is genuinely missing, and says which. */

const people: SheetPerson[] = [
  { last: 'Reyes', first: 'Ana', months: [[100, 200, 10], undefined, undefined], targets: [3000, 1500, 4000, 480] },
  { last: 'Santos', first: 'Ben', area: 'CARAGA', months: [[0, 50.5, 7], undefined, undefined], targets: [3000, 1500, 4000, 480] },
]

describe('header-driven layout', () => {
  it('parses the standard layout', async () => {
    const result = await parseBytes(await buildWorkbook({ people }))
    expect(result.fatal).toBeNull()
    expect(codes(result, 'error')).toEqual([])
    expect(result.people.map((p) => p.months[0].inhouse + p.months[0].ethical)).toEqual([30_000, 5_050])
  })

  it('survives reordered columns: targets first, ethical before in-house', async () => {
    const result = await parseBytes(await buildWorkbook({ people, shuffled: true }))
    expect(codes(result, 'error')).toEqual([])
    const ana = result.people[0]
    expect(ana.months[0]).toMatchObject({ inhouse: 10_000, ethical: 20_000, calls: 10 })
    expect(ana.targets).toEqual({ inhouse: 300_000, ethical: 150_000, combi: 400_000, calls: 480 })
  })

  it('survives a header that starts on row 8', async () => {
    const result = await parseBytes(await buildWorkbook({ people, headerRow: 8 }))
    expect(result.headerRow).toBe(8)
    expect(result.people.map((p) => p.sourceRow)).toEqual([11, 12])
    expect(result.quarter).toBe(4)
  })

  it('picks up an added person', async () => {
    const more = [...people, { last: 'Cruz', first: 'Carla', months: [[1, 1, 1], undefined, undefined] as SheetPerson['months'] }]
    const result = await parseBytes(await buildWorkbook({ people: more }))
    expect(result.people).toHaveLength(3)
  })

  it('reads the month headers of any quarter', async () => {
    const result = await parseBytes(
      await buildWorkbook({ people, monthNames: ['JANUARY', 'FEBRUARY', 'MARCH'], quarterWord: 'FIRST' }),
    )
    expect(result.quarter).toBe(1)
    expect(result.calendarMonths).toEqual([1, 2, 3])
  })

  it('names the missing header', async () => {
    const result = await parseBytes(await buildWorkbook({ people, omit: { month: 1, metric: 'ETHICAL' } }))
    const missing = result.issues.find((i) => i.code === 'header_missing')
    expect(missing?.severity).toBe('error')
    expect(missing?.message).toContain('No ETHICAL column under NOVEMBER')
    expect(result.people).toEqual([])
  })

  it('treats a missing TARGETS block as a warning, not an error', async () => {
    const result = await parseBytes(await buildWorkbook({ people, withTargets: false }))
    expect(codes(result, 'error')).toEqual([])
    expect(codes(result, 'warning')).toContain('targets_missing')
    expect(result.people[0].targets).toEqual({ inhouse: null, ethical: null, combi: null, calls: null })
  })

  it('flags a quarter label that disagrees with the months', async () => {
    const result = await parseBytes(await buildWorkbook({ people, quarterWord: 'FIRST' }))
    expect(codes(result, 'error')).toContain('period_conflict')
  })

  it('takes the quarter from the months when there is no label', async () => {
    const result = await parseBytes(await buildWorkbook({ people, quarterWord: null }))
    expect(result.quarter).toBe(4)
    expect(codes(result, 'info')).toContain('period_from_months')
  })

  it('without a TOTAL row, stops at the first blank row and says so', async () => {
    const bytes = await buildWorkbook({ people, totalRow: false })
    // Re-open and add a stray row after a blank line.
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(bytes)
    wb.getWorksheet('Sheet1')!.getCell('A10').value = 'Stray'
    wb.getWorksheet('Sheet1')!.getCell('B10').value = 'Row'
    const result = await parseBytes((await wb.xlsx.writeBuffer()) as ArrayBuffer)
    expect(result.people).toHaveLength(2)
    expect(codes(result, 'warning')).toContain('rows_after_blank')
  })

  it('finds the table on a sheet that is not called Sheet1', async () => {
    const result = await parseBytes(await buildWorkbook({ people, extraSheets: ['Notes'] }))
    expect(result.sheetName).toBe('Sheet1')
    expect(codes(result, 'info')).toContain('sheet_chosen')
  })
})
