import { describe, expect, it } from 'vitest'
import { manilaToday, quarterFromLabel, suggestYear } from '@/lib/excel/period'
import { nameKey, nameKeySimilarity, normalizeNamePart } from '@/lib/excel/names'
import { diffUpload, type KnownPerson, type SnapshotPerson } from '@/lib/excel/diff'
import { buildCommitPayload } from '@/lib/excel/payload'
import { buildTemplate } from '@/lib/excel/template'
import { canCommit } from '@/lib/excel/types'
import { FIXTURE, codes, parseBytes, parseFile } from '../helpers/workbooks'

describe('period', () => {
  it.each([
    ['FOURTH', 4],
    ['first', 1],
    ['2nd', 2],
    ['Q3', 3],
    ['FOURTH QUARTER', 4],
  ])('reads %s as Q%d', (label, quarter) => {
    expect(quarterFromLabel(label)).toBe(quarter)
  })

  it('uses the Manila calendar, not the device clock', () => {
    // 17:00 UTC on 31 Dec is already 1 January in Manila.
    expect(manilaToday(new Date('2026-12-31T17:00:00Z'))).toMatchObject({ year: 2027, quarter: 1 })
  })

  it('suggests the current year, or last year for a quarter that has not started', () => {
    expect(suggestYear(4, new Date('2026-10-20T04:00:00Z'))).toBe(2026)
    expect(suggestYear(4, new Date('2027-01-08T04:00:00Z'))).toBe(2026)
    expect(suggestYear(1, new Date('2027-01-08T04:00:00Z'))).toBe(2027)
  })
})

describe('name keys', () => {
  it('ignore accents, case, punctuation and spacing', () => {
    expect(nameKey('Piñuela', 'Arlene')).toBe(nameKey('  PINUELA ', 'arlene'))
    expect(nameKey('Dela-Cruz', 'Ma. Teresa')).toBe('dela cruz|ma teresa')
    expect(normalizeNamePart('Ñoño')).toBe('nono')
  })

  it('score near misses high and strangers low', () => {
    expect(nameKeySimilarity('pinuella|arlene', 'pinuela|arlene')).toBeGreaterThan(0.9)
    expect(nameKeySimilarity('arlene|pinuela', 'pinuela|arlene')).toBe(1)
    expect(nameKeySimilarity('santos|ben', 'pinuela|arlene')).toBeLessThan(0.5)
  })
})

describe('diff against the current version', () => {
  const known: KnownPerson[] = [
    { id: 'p-ana', nameKey: 'reyes|ana', lastName: 'Reyes', firstName: 'Ana', aliases: [] },
    { id: 'p-arl', nameKey: 'ibanez|arlene', lastName: 'Ibañez', firstName: 'Arlene', aliases: [] },
    { id: 'p-old', nameKey: 'gone|gary', lastName: 'Gone', firstName: 'Gary', aliases: [] },
  ]

  it('marks everyone as first-time when the quarter has no upload yet', async () => {
    const parsed = await parseFile(FIXTURE)
    const diff = diffUpload(parsed.people, null, known, [10, 11, 12])
    expect(diff.hasPrevious).toBe(false)
    expect(diff.counts.known).toBe(1) // Ibañez, Arlene is already known
    expect(diff.counts.new).toBe(11)
  })

  it('reports changed values old → new, added and removed people', async () => {
    const parsed = await parseFile(FIXTURE)
    const arlene = parsed.people.find((p) => p.nameKey === 'ibanez|arlene')!
    const previous: SnapshotPerson[] = [
      {
        personId: 'p-arl',
        lastName: 'Ibañez',
        firstName: 'Arlene',
        position: 'psr',
        area: 'south',
        months: { 1: { inhouse: 0, ethical: 500_000, calls: 50 } },
        targets: { ...arlene.targets, calls: 450 },
      },
      { personId: 'p-old', lastName: 'Gone', firstName: 'Gary', position: 'psr', area: 'north', months: {}, targets: { inhouse: null, ethical: null, combi: null, calls: null } },
    ]
    const diff = diffUpload(parsed.people, previous, known, [10, 11, 12])
    const changed = diff.entries.find((e) => e.personId === 'p-arl')!
    expect(changed.kind).toBe('changed')
    expect(changed.changes.map((c) => c.label)).toEqual(['Area', 'October ethical', 'October calls', 'Calls target'])
    expect(changed.changes[1]).toEqual({ label: 'October ethical', before: '₱5,000.00', after: '₱10,754.11' })
    expect(diff.entries.find((e) => e.kind === 'removed')?.name).toBe('Gone, Gary')
  })

  it('offers "same person as…?" for a near-miss spelling instead of a silent duplicate', () => {
    const parsed = [{ nameKey: 'ibanez|arlen', lastName: 'Ibanez', firstName: 'Arlen' }] as never
    const diff = diffUpload(parsed, null, known, [10, 11, 12])
    expect(diff.entries[0].kind).toBe('new')
    expect(diff.entries[0].suggestions[0]).toMatchObject({ personId: 'p-arl', name: 'Ibañez, Arlene' })
  })

  it('honours a match chosen in the preview', () => {
    const parsed = [{ nameKey: 'ibanez|arlen', lastName: 'Ibanez', firstName: 'Arlen', months: [], targets: {} }] as never
    const diff = diffUpload(parsed, null, known, [10, 11, 12], { 'ibanez|arlen': 'p-arl' })
    expect(diff.entries[0]).toMatchObject({ kind: 'known', personId: 'p-arl' })
  })
})

describe('commit payload', () => {
  it('sends centavos, only months with data, matches, and warnings', async () => {
    const parsed = await parseFile(FIXTURE)
    const payload = buildCommitPayload(parsed, {
      year: 2026,
      filePath: '2026-Q4/00000000-0000-0000-0000-000000000000.xlsx',
      sha256: 'a'.repeat(64),
      matches: { 'ibanez|arlene': 'p-arl' },
    })
    expect(payload.period_quarter).toBe(4)
    expect(payload.months_with_data).toEqual([1])
    expect(payload.people).toHaveLength(12)
    const arlene = payload.people.find((p) => p.name_key === 'ibanez|arlene')!
    expect(arlene.person_id).toBe('p-arl')
    expect(arlene.months).toEqual([{ month: 1, inhouse_centavos: 0, ethical_centavos: 1_075_411, calls: 56 }])
    expect(arlene.targets.combi_centavos).toBe(400_000_000)
    expect(payload.people.every((p) => p.months.every((m) => Number.isInteger(m.inhouse_centavos)))).toBe(true)
    expect(payload.warnings.map((w) => w.code)).toContain('no_targets')
    expect(payload.warnings.map((w) => w.code)).not.toContain('sheet_chosen')
  })
})

describe('blank template', () => {
  it('has headers the parser accepts; empty, it only lacks people', async () => {
    const result = await parseBytes(await buildTemplate({ quarter: 4 }), 'template.xlsx')
    expect(result.fatal).toBeNull()
    expect(result.quarter).toBe(4)
    expect(result.calendarMonths).toEqual([10, 11, 12])
    expect(result.sheetName).toBe('PERFORMANCE')
    // Nothing about the layout is wrong; there is simply nobody in it yet.
    expect(codes(result, 'error')).toEqual(['no_people'])
  })

  it('round-trips a filled-in copy with no errors', async () => {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await buildTemplate({ quarter: 4 }))
    const sheet = wb.getWorksheet('PERFORMANCE')!
    sheet.getCell('A6').value = 'Reyes'
    sheet.getCell('B6').value = 'Ana'
    sheet.getCell('C6').value = 'PSR'
    sheet.getCell('D6').value = 'NORTH'
    sheet.getCell('E6').value = 1500.25
    sheet.getCell('H6').value = 120
    ;['U6', 'V6', 'W6', 'X6'].forEach((ref, i) => (sheet.getCell(ref).value = [3e6, 1.5e6, 4e6, 480][i]))
    const result = await parseBytes((await wb.xlsx.writeBuffer()) as ArrayBuffer, 'filled.xlsx')
    expect(codes(result, 'error')).toEqual([])
    expect(result.people).toHaveLength(1)
    expect(result.people[0].months[0]).toMatchObject({ inhouse: 150_025, calls: 120, hasData: true })
    expect(result.monthsWithData).toEqual([1])
  })

  it('carries a roster and its targets', async () => {
    const roster = [
      { lastName: 'Ibañez', firstName: 'Arlene', position: 'psr' as const, area: 'north' as const, targets: { inhouse: 300_000_000, ethical: 150_000_000, combi: 400_000_000, calls: 480 } },
      { lastName: 'Pascual', firstName: 'Ireneo', position: 'group_head' as const, area: 'na' as const },
    ]
    const result = await parseBytes(await buildTemplate({ quarter: 1, roster }), 'template.xlsx')
    expect(result.people.map((p) => p.nameKey)).toEqual(['ibanez|arlene', 'pascual|ireneo'])
    expect(result.people[0].targets).toEqual(roster[0].targets)
    expect(result.calendarMonths).toEqual([1, 2, 3])
    expect(canCommit(result)).toBe(true)
  })
})
