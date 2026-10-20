import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  currentByPeriod,
  DEFAULT_SETTINGS,
  formatPercent,
  fromParsed,
  personMetrics,
  personTellTales,
  rankBy,
  rankPeople,
  selectTop,
  teamMetrics,
  teamTellTales,
  toCentavos,
  toPersonPeriods,
  type MetricContext,
  type PersonMetrics,
  type PersonPeriod,
} from '@/lib/metrics'
import type { Upload } from '@/types/sales'
import { FIXTURE, parseFile } from '../helpers/workbooks'

const M = (pesos: number) => toCentavos(pesos)
const ctx = (overrides: Partial<MetricContext> = {}): MetricContext => ({
  selection: { kind: 'qtd' },
  monthsWithData: [1],
  settings: DEFAULT_SETTINGS,
  adminTargets: [],
  ...overrides,
})

let periods: PersonPeriod[]
const metricsFor = (c = ctx()) => periods.map((p) => personMetrics(p, c))
const byLast = (people: PersonMetrics[], last: string) => people.find((p) => p.lastName === last)!

beforeAll(async () => {
  const parsed = await parseFile(FIXTURE)
  periods = fromParsed(parsed.people, parsed.monthsWithData)
})

describe('the sample quarter, through the metrics', () => {
  it('a PSR’s October attainment is against a third of the quarter target', () => {
    // Espino (the sample's top collector): ₱140,512.28 of ₱1,333,333.33 → 11%
    const espino = byLast(metricsFor(ctx({ selection: { kind: 'month', month: 1 } })), 'Espino')
    expect(formatPercent(espino.attainment.combi)).toBe('11%')
    expect(espino.pace.status).toBe('behind')
  })

  it('quarter-to-date attainment uses the quarter target; pace says whether that is on schedule', () => {
    const espino = byLast(metricsFor(), 'Espino')
    expect(espino.attainment.combi).toBeCloseTo(140_512.28 / 4_000_000, 10)
    expect(espino.pace.ratio).toBeCloseTo((140_512.28 * 3) / 4_000_000, 10)
    expect(espino.catchUp.combi).toBe(M(1_333_333.33) - M(140_512.28))
    expect(espino.projection.amount).toBe(M(421_536.84))
  })

  it('supervisors without targets count in totals but not in attainment (open question 2)', () => {
    const everyone = metricsFor()
    const team = teamMetrics(everyone, ctx())
    expect(team.headcount).toBe(12)
    expect(team.measuredCount).toBe(8)
    expect(team.totals.combi).toBe(24_564_986) // includes the supervisor's ₱4,981
    expect(team.measuredActual.combi).toBe(24_564_986 - M(4_981))
    expect(team.targets.combi).toBe(M(32_000_000))
    expect(team.attainment.combi).toBeCloseTo(240_668.86 / 32_000_000, 10)
    expect(byLast(everyone, 'Navarro').attainment.combi).toBeNull()
    expect(byLast(everyone, 'Navarro').pace.status).toBe('no_target')
  })

  it('team calls: 911 made, against 8 PSRs × 480', () => {
    const team = teamMetrics(metricsFor(), ctx())
    expect(team.totals.calls).toBe(911)
    // Only targeted people's calls are compared with their targets.
    expect(team.attainment.calls).toBeCloseTo(699 / 3840, 10)
  })

  it('November has no data yet — not 0%', () => {
    const november = ctx({ selection: { kind: 'month', month: 2 } })
    const people = metricsFor(november)
    const team = teamMetrics(people, november)
    expect(team.hasData).toBe(false)
    expect(team.attainment.combi).toBeNull()
    expect(team.pace.status).toBe('no_data')
    expect(formatPercent(team.attainment.combi)).toBe('—')
    expect(people.every((p) => p.months[1].hasData === false && p.months[1].values === null)).toBe(true)
  })

  it('ranks by combi with shared ranks and zeros last', () => {
    const psrs = metricsFor().filter((p) => p.position === 'psr')
    const ranked = rankPeople(psrs, 'combi')
    expect(ranked.map((r) => [r.item.lastName, r.rank])).toEqual([
      ['Espino', 1],
      ['Dela Peña', 2],
      ['Cruz', 3],
      ['Ibañez', 4],
      ['Bautista', 5],
      ['Alcantara', 6],
      ['Flores', 6],
      ['Lim', 6],
    ])
  })

  it('North + Caraga, top 3 by combi', () => {
    const set = metricsFor().filter((p) => p.position === 'psr' && (p.area === 'north' || p.area === 'caraga'))
    const top = selectTop(rankPeople(set, 'combi'), 3, 'top')
    expect(top.map((r) => r.item.lastName)).toEqual(['Espino', 'Dela Peña', 'Cruz'])
  })

  it('never ranks people without targets', () => {
    const everyone = rankPeople(metricsFor(), 'combi')
    const supervisors = everyone.filter((r) => r.item.position !== 'psr')
    expect(supervisors.every((r) => r.rank === null)).toBe(true)
    expect(everyone.slice(-4).every((r) => r.rank === null)).toBe(true)
  })

  it('lights the right tell-tales', () => {
    const people = metricsFor()
    const lamps = personTellTales(byLast(people, 'Alcantara'), DEFAULT_SETTINGS)
    // ₱0 collected, and 85 of 160 expected calls (53%) is under the 70% line.
    expect(lamps.filter((l) => l.lit).map((l) => l.key)).toEqual(['behind_pace', 'no_inhouse', 'no_ethical', 'calls_low'])
    expect(lamps.find((l) => l.key === 'calls_low')?.detail).toBe('53% of expected')
    const espino = personTellTales(byLast(people, 'Espino'), DEFAULT_SETTINGS)
    expect(espino.find((l) => l.key === 'no_inhouse')?.lit).toBe(false)
    expect(espino.find((l) => l.key === 'no_ethical')?.lit).toBe(true)
    const team = teamTellTales(teamMetrics(people, ctx()), people, DEFAULT_SETTINGS)
    // Only Cruz and Espino collected in-house in October; 6 of 8 PSRs are at ₱0.
    expect(team.find((l) => l.key === 'no_inhouse')?.detail).toBe('6 people at ₱0')
    expect(team.every((l) => l.label.length > 0)).toBe(true)
  })
})

describe('ranking rules', () => {
  const rank = (values: (number | null)[]) => rankBy(values, (v) => v).map((r) => [r.value, r.rank])

  it('equal values share a rank: 1, 2, 2, 4', () => {
    expect(rank([50, 30, 30, 10])).toEqual([[50, 1], [30, 2], [30, 2], [10, 4]])
  })

  it('zero-value people never rank above anyone with data — even net negative', () => {
    expect(rank([0, -500, 100, 0])).toEqual([[100, 1], [-500, 2], [0, 3], [0, 3]])
  })

  it('unranked (null) people come last without a rank', () => {
    expect(rank([null, 5, 0])).toEqual([[5, 1], [0, 2], [null, null]])
  })

  it('top N keeps ties at the cut; bottom N lists the worst first', () => {
    const ranked = rankBy([90, 80, 70, 70, 60, 0, null], (v) => v)
    expect(selectTop(ranked, 3, 'top').map((r) => r.value)).toEqual([90, 80, 70, 70])
    expect(selectTop(ranked, 2, 'bottom').map((r) => r.value)).toEqual([0, 60])
    expect(selectTop(ranked, 'all', 'top')).toHaveLength(6)
  })
})

describe('edge cases (brief §9)', () => {
  const base: PersonPeriod = {
    personId: 'x', lastName: 'Test', firstName: 'Tess', position: 'psr', area: 'north',
    months: {}, fileTargets: { inhouse: M(3_000_000), ethical: M(1_500_000), combi: M(4_000_000), calls: 480 },
  }

  it('attainment over 100% keeps its real value', () => {
    const star = personMetrics({ ...base, months: { 1: { inhouse: M(1_500_000), ethical: M(286_666.67), calls: 200 } } }, ctx({ selection: { kind: 'month', month: 1 } }))
    expect(formatPercent(star.attainment.combi)).toBe('134%')
    expect(star.pace.status).toBe('ahead')
    expect(star.catchUp.combi).toBe(0)
  })

  it('no target set: em dash and its own status', () => {
    const none = personMetrics({ ...base, fileTargets: { inhouse: null, ethical: null, combi: null, calls: null }, months: { 1: { inhouse: M(5), ethical: 0, calls: 1 } } }, ctx())
    expect(formatPercent(none.attainment.combi)).toBe('—')
    expect(none.pace.status).toBe('no_target')
    expect(none.measured).toBe(false)
  })

  it('negative adjustments reduce the totals and light no-in-house', () => {
    const returns = personMetrics({ ...base, months: { 1: { inhouse: M(-2_000), ethical: M(10_000), calls: 10 } } }, ctx())
    expect(returns.actual.combi).toBe(M(8_000))
    expect(personTellTales(returns, DEFAULT_SETTINGS).find((l) => l.key === 'no_inhouse')?.lit).toBe(true)
  })

  it('a later quarter’s transfer does not rewrite this quarter’s area', () => {
    const [snap] = toPersonPeriods(
      [{ upload_id: 'u', person_id: 'p', position: 'psr', area: 'south', source_row: 6, source_last_name: 'Old', source_first_name: 'Name', target_inhouse: 3_000_000, target_ethical: 1_500_000, target_combi: 4_000_000, target_calls: 480 }],
      [{ upload_id: 'u', person_id: 'p', month: 1, inhouse: 100.5, ethical: 0, calls: 3 }],
      new Map([['p', { last_name: 'Fixed', first_name: 'Name' }]]),
    )
    expect(snap.area).toBe('south') // the person's current area might be caraga now
    expect(snap.lastName).toBe('Fixed') // but names follow admin fixes
    expect(snap.months[1]?.inhouse).toBe(10_050)
    expect(snap.fileTargets.combi).toBe(400_000_000)
  })

  it('two uploads for one quarter: the latest wins, history kept', () => {
    const upload = (version: number, is_current: boolean, quarter: 3 | 4 = 4) =>
      ({ id: `v${version}-${quarter}`, period_year: 2026, period_quarter: quarter, version, is_current }) as Upload
    const current = currentByPeriod([upload(1, false), upload(2, true), upload(1, true, 3)])
    expect(current.map((u) => u.id)).toEqual(['v2-4', 'v1-3'])
    // Restoring v1 flips the flag; the flag wins over the higher version.
    expect(currentByPeriod([upload(1, true), upload(2, false)]).map((u) => u.id)).toEqual(['v1-4'])
  })
})

describe('no hardcoded targets', () => {
  it('the metrics library contains none of the workbook’s magic numbers', () => {
    const dir = resolve('src/lib/metrics')
    const source = readdirSync(dir).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n')
    for (const magic of ['350000', '983333', '1050000', '2950000', '160']) {
      expect(source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')).not.toContain(magic)
    }
  })
})
