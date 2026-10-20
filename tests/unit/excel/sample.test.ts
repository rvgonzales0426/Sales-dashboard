import { describe, expect, it } from 'vitest'
import { canCommit, errorsIn } from '@/lib/excel/types'
import { FIXTURE, REAL_FIXTURE, codes, editFixture, hasRealFixture, parseBytes, parseFile } from '../helpers/workbooks'
import type { ParseResult } from '@/lib/excel/types'

/* The acceptance numbers from the brief, against the committed (anonymized)
 * fixture and — on a machine that has it — the real workbook. Both must agree,
 * which also proves the anonymizer changed names and nothing else. */

const octoberTotals = (result: ParseResult) =>
  result.people.reduce(
    (sum, p) => ({
      inhouse: sum.inhouse + p.months[0].inhouse,
      ethical: sum.ethical + p.months[0].ethical,
      combi: sum.combi + p.months[0].inhouse + p.months[0].ethical,
      calls: sum.calls + p.months[0].calls,
    }),
    { inhouse: 0, ethical: 0, combi: 0, calls: 0 },
  )

function sampleAssertions(load: () => Promise<ParseResult>) {
  it('reads Sheet1 and ignores DASHBOARD and Sheet2', async () => {
    const result = await load()
    expect(result.fatal).toBeNull()
    expect(result.sheetName).toBe('Sheet1')
    expect(result.sheetNames).toEqual(['DASHBOARD', 'Sheet1', 'Sheet2'])
    expect(codes(result, 'info')).toContain('sheet_chosen')
  })

  it('finds 12 people: 8 PSRs, 3 supervisors, 1 group head', async () => {
    const result = await load()
    expect(result.people).toHaveLength(12)
    const byPosition = (pos: string) => result.people.filter((p) => p.position === pos).length
    expect(byPosition('psr')).toBe(8)
    expect(byPosition('supervisor')).toBe(3)
    expect(byPosition('group_head')).toBe(1)
  })

  it('totals October combi at ₱245,649.86 and calls at 911', async () => {
    const totals = octoberTotals(await load())
    expect(totals.inhouse).toBe(15_944_056)
    expect(totals.ethical).toBe(8_620_930)
    expect(totals.combi).toBe(24_564_986)
    expect(totals.calls).toBe(911)
  })

  it('excludes the TOTAL row by its label', async () => {
    const result = await load()
    expect(result.excluded).toEqual([{ row: 19, label: 'TOTAL', reason: 'total' }])
    expect(result.people.some((p) => /total/i.test(p.lastName))).toBe(false)
    expect(Math.max(...result.people.map((p) => p.sourceRow))).toBe(17)
  })

  it('detects Q4 from B2 and the month headers, and suggests 2026', async () => {
    const result = await load()
    expect(result.quarter).toBe(4)
    expect(result.quarterLabel).toBe('FOURTH')
    expect(result.calendarMonths).toEqual([10, 11, 12])
    expect(result.suggestedYear).toBe(2026)
  })

  it('treats November and December as no data yet, not zero', async () => {
    const result = await load()
    expect(result.monthsWithData).toEqual([1])
    expect(result.people.every((p) => !p.months[1].hasData && !p.months[2].hasData)).toBe(true)
  })

  it('reads targets as quarter figures, including the =SUM(U6) chain', async () => {
    const result = await load()
    const psrs = result.people.filter((p) => p.position === 'psr')
    for (const p of psrs) {
      expect(p.targets).toEqual({ inhouse: 300_000_000, ethical: 150_000_000, combi: 400_000_000, calls: 480 })
    }
    expect(result.issues.find((i) => i.code === 'formula_input')?.cell).toBe('U7:U13')
  })

  it('warns, without blocking, about missing targets and the combi target mismatch', async () => {
    const result = await load()
    expect(errorsIn(result)).toEqual([])
    expect(canCommit(result)).toBe(true)
    expect(codes(result, 'warning').filter((c) => c === 'no_targets')).toHaveLength(4)
    expect(codes(result, 'warning')).toContain('combi_target_mismatch')
  })
}

describe('sample workbook (anonymized fixture)', () => {
  sampleAssertions(() => parseFile(FIXTURE))

  it('normalizes accented and spaced placeholder names', async () => {
    const result = await parseFile(FIXTURE)
    const keys = result.people.map((p) => p.nameKey)
    expect(keys).toContain('dela pena|marco jose')
    expect(keys).toContain('ibanez|arlene')
    expect(result.people.find((p) => p.nameKey === 'ibanez|arlene')?.lastName).toBe('Ibañez')
  })
})

describe.skipIf(!hasRealFixture)('sample workbook (real file, local only)', () => {
  sampleAssertions(() => parseFile(REAL_FIXTURE))
})

describe('a broken combi formula in the file', () => {
  it('does not change the computed result', async () => {
    const clean = octoberTotals(await parseFile(FIXTURE))
    const bytes = await editFixture((wb) => {
      const sheet = wb.getWorksheet('Sheet1')!
      // The DASHBOARD sheet's bug, planted in the source sheet, with a cached
      // result that is wildly wrong.
      sheet.getCell('G6').value = { formula: '(F6/350000)*(E6/983333.33)', result: 999_999 }
      sheet.getCell('G10').value = { formula: 'E10*F10', result: 0.5 }
      sheet.getCell('S9').value = { formula: 'Q9-R9', result: -65_493.19 }
    })
    const broken = await parseBytes(bytes)
    expect(octoberTotals(broken)).toEqual(clean)
    const notice = broken.issues.find((i) => i.code === 'cached_mismatch')
    expect(notice?.severity).toBe('info')
    expect(notice?.cell).toContain('G6')
    expect(notice?.cell).toContain('G10')
  })
})
