import { describe, expect, it } from 'vitest'
import { parseNumericText, readNumberCell } from '@/lib/excel/cells'
import { canCommit } from '@/lib/excel/types'
import { buildWorkbook, codes, parseBytes, type SheetPerson } from '../helpers/workbooks'

const oct = (inhouse: unknown, ethical: unknown, calls: unknown): SheetPerson['months'] => [
  [inhouse, ethical, calls],
  undefined,
  undefined,
]
const targets: SheetPerson['targets'] = [3_000_000, 1_500_000, 4_000_000, 480]

async function parsePeople(people: SheetPerson[]) {
  return parseBytes(await buildWorkbook({ people }))
}

describe('numeric text', () => {
  it.each([
    ['1,234.50', 1234.5],
    ['₱1,234.50', 1234.5],
    ['PHP 2,000', 2000],
    ['P500', 500],
    ['(1,000.00)', -1000],
    ['-250', -250],
    [' 42 ', 42],
  ])('reads %s as %d', (text, value) => {
    expect(parseNumericText(text)).toBe(value)
  })

  it.each(['n/a', 'abc', '12abc', '1.2.3', ''])('refuses %s', (text) => {
    expect(parseNumericText(text)).toBeNull()
  })

  it('reads an accounting dash as zero', () => {
    expect(readNumberCell({ kind: 'text', value: '—' }, 'E6')).toMatchObject({ value: 0, present: true })
  })
})

describe('cell problems are flagged inline', () => {
  it('blank cells are zero, and a row of blanks is still a person', async () => {
    const result = await parsePeople([{ last: 'Reyes', first: 'Ana', targets }])
    expect(result.people[0].months[0]).toMatchObject({ inhouse: 0, ethical: 0, calls: 0, hasData: false })
  })

  it('text that is a number: warning, value kept, cell named', async () => {
    const result = await parsePeople([{ last: 'Reyes', first: 'Ana', months: oct('1,234.50', 0, 5), targets }])
    const issue = result.issues.find((i) => i.code === 'text_number')
    expect(issue).toMatchObject({ severity: 'warning', cell: 'E6', field: 'inhouse', month: 1 })
    expect(result.people[0].months[0].inhouse).toBe(123_450)
    expect(canCommit(result)).toBe(true)
  })

  it('text that is not a number: error, commit blocked', async () => {
    const result = await parsePeople([{ last: 'Reyes', first: 'Ana', months: oct(0, 'n/a', 5), targets }])
    expect(result.issues.find((i) => i.code === 'non_numeric')).toMatchObject({ severity: 'error', cell: 'F6' })
    expect(canCommit(result)).toBe(false)
  })

  it('an error value such as #REF! is an error', async () => {
    const result = await parsePeople([{ last: 'Reyes', first: 'Ana', months: oct({ error: '#REF!' }, 0, 5), targets }])
    expect(result.issues.find((i) => i.code === 'error_cell')?.message).toContain('#REF!')
  })

  it('negative collections are a warning (returns), negative calls an error', async () => {
    const result = await parsePeople([{ last: 'Reyes', first: 'Ana', months: oct(-500, 0, -3), targets }])
    expect(result.issues.find((i) => i.code === 'negative_amount')?.severity).toBe('warning')
    expect(result.people[0].months[0].inhouse).toBe(-50_000)
    expect(result.issues.find((i) => i.code === 'negative_calls')?.severity).toBe('error')
  })

  it('fractional calls are an error', async () => {
    const result = await parsePeople([{ last: 'Reyes', first: 'Ana', months: oct(0, 0, 2.5), targets }])
    expect(codes(result, 'error')).toContain('fractional_calls')
  })

  it('unknown area and unknown position are errors that name the value', async () => {
    const result = await parsePeople([
      { last: 'Reyes', first: 'Ana', area: 'MINDANAO', targets },
      { last: 'Santos', first: 'Ben', position: 'MANAGER', targets },
    ])
    expect(result.issues.find((i) => i.code === 'unknown_area')?.message).toContain('MINDANAO')
    expect(result.issues.find((i) => i.code === 'unknown_position')?.message).toContain('MANAGER')
  })

  it('accepts position and area spellings people actually type', async () => {
    const result = await parsePeople([
      { last: 'A', first: 'A', position: 'Group Head', area: 'n/a' },
      { last: 'B', first: 'B', position: 'supervisor', area: 'Caraga' },
      { last: 'C', first: 'C', position: 'GROUP HEAD', area: '' },
    ])
    expect(result.people.map((p) => [p.position, p.area])).toEqual([
      ['group_head', 'na'],
      ['supervisor', 'caraga'],
      ['group_head', 'na'],
    ])
    expect(codes(result, 'error')).toEqual([])
  })

  it('a duplicate person — even spelt with different accents and case — is an error', async () => {
    const result = await parsePeople([
      { last: 'Ibañez', first: 'Arlene', targets },
      { last: 'IBANEZ ', first: ' arlene', targets },
    ])
    const dup = result.issues.find((i) => i.code === 'duplicate_person')
    expect(dup?.severity).toBe('error')
    expect(dup?.message).toContain('Rows 6 and 7')
  })

  it('a row with numbers but no name is an error', async () => {
    const result = await parsePeople([{ last: '', first: '', months: oct(100, 0, 1) }])
    expect(result.issues.find((i) => i.code === 'missing_name')?.message).toContain('no name')
  })

  it('blank targets are "no target", a typed zero is a zero target', async () => {
    const result = await parsePeople([
      { last: 'Reyes', first: 'Ana' },
      { last: 'Santos', first: 'Ben', targets: [0, 0, 0, 0] },
    ])
    expect(result.people[0].targets.combi).toBeNull()
    expect(result.people[1].targets.combi).toBe(0)
    expect(result.issues.filter((i) => i.code === 'no_targets')).toHaveLength(1)
  })

  it('partial targets get a warning naming what is missing', async () => {
    const result = await parsePeople([{ last: 'Reyes', first: 'Ana', targets: [3_000_000, undefined, undefined, 480] }])
    expect(result.issues.find((i) => i.code === 'partial_targets')?.message).toContain('ethical, combi')
  })
})

describe('names', () => {
  it('cleans extra spaces and shouting, keeps deliberate casing', async () => {
    const result = await parsePeople([
      { last: '  PIÑUELA ', first: 'ARLENE   MAE' },
      { last: 'mcarthur', first: 'john' },
      { last: 'McArthur', first: 'de la Rosa' },
    ])
    expect(result.people.map((p) => `${p.lastName}, ${p.firstName}`)).toEqual([
      'Piñuela, Arlene Mae',
      'Mcarthur, John',
      'McArthur, de la Rosa',
    ])
    expect(result.people[0].nameKey).toBe('pinuela|arlene mae')
  })
})
