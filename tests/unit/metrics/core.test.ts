import { describe, expect, it } from 'vitest'
import {
  attainment,
  attainmentOfShare,
  callsCatchUp,
  catchUp,
  expectedToDate,
  formatPeso,
  formatPesoCompact,
  formatPercent,
  paceStatus,
  pinned,
  projection,
  resolveTargets,
  sumCentavos,
  toCentavos,
  DEFAULT_SETTINGS,
  type AdminTarget,
} from '@/lib/metrics'

/* Brief §5, bullet by bullet. Money in centavos: ₱1 = 100. */

const M = (pesos: number) => toCentavos(pesos)

describe('money has no floating-point drift', () => {
  it('converts pesos to whole centavos, rounding the decimal a person typed', () => {
    expect(toCentavos(140512.28)).toBe(14_051_228) // 140512.28 × 100 = 14051227.999… in floats
    expect(toCentavos(0.285)).toBe(29) // 0.28499999999999998 in binary
    expect(toCentavos(-0.285)).toBe(-29)
    expect(toCentavos(18928.28)).toBe(1_892_828)
  })

  it('sums exactly where floats would not', () => {
    expect(0.1 + 0.2).not.toBe(0.3)
    expect(sumCentavos([M(0.1), M(0.2)])).toBe(M(0.3))
    const october = [0, 4981, 18928.28, 65493.19, 140512.28, 0, 10754.11, 0, 0, 4981, 0, 0]
    expect(sumCentavos(october.map(M))).toBe(24_564_986)
  })

  it('holds the largest numeric(14,2) value exactly', () => {
    const max = M(999_999_999_999.99)
    expect(max).toBe(99_999_999_999_999)
    expect(Number.isSafeInteger(max)).toBe(true)
  })

  it('formats in en-PH pesos, compactly when asked', () => {
    expect(formatPeso(24_564_986)).toBe('₱245,649.86')
    expect(formatPeso(M(4_000_000), { whole: true })).toBe('₱4,000,000')
    expect(formatPesoCompact(M(12_400_000))).toBe('₱12.4M')
    expect(formatPesoCompact(M(245_649.86))).toBe('₱246K')
    expect(formatPesoCompact(M(4_000_000))).toBe('₱4M')
    expect(formatPesoCompact(M(-1_500))).toBe('−₱1.5K')
    expect(formatPesoCompact(M(980))).toBe('₱980')
  })
})

describe('attainment = actual ÷ target', () => {
  it('is null — never 0% or Infinity — when the target is 0 or missing', () => {
    expect(attainment(100, 0)).toBeNull()
    expect(attainment(100, null)).toBeNull()
    expect(attainment(100, undefined)).toBeNull()
    expect(formatPercent(attainment(100, 0))).toBe('—')
  })

  it('combi attainment is combi actual ÷ combi target, not a product of ratios', () => {
    // 50% of in-house and 50% of ethical is 50% combi — the workbook's
    // (ethical/350000) × (inhouse/983333.33) would call it 25%.
    const inhouse = M(1_500_000)
    const ethical = M(750_000)
    const combiTarget = M(4_500_000)
    expect(attainment(inhouse + ethical, combiTarget)).toBe(0.5)
    expect(attainment(inhouse, M(3_000_000))! * attainment(ethical, M(1_500_000))!).toBe(0.25)
  })

  it('monthly target is a third of the quarter, computed exactly', () => {
    // ₱4,000,000 / 3 does not end in whole centavos; the ratio stays exact.
    // 133,333,333 × 3 ÷ 400,000,000 — one centavo short of 100%, and it says so.
    expect(attainmentOfShare(M(1_333_333.33), M(4_000_000), 1)).toBe(399_999_999 / 400_000_000)
    expect(attainmentOfShare(M(140_512.28), M(4_000_000), 1)).toBeCloseTo(0.105384, 6)
  })

  it('quarter calls use the quarter target of 480, not the monthly 160', () => {
    expect(attainment(240, 480)).toBe(0.5) // the workbook's 240/160 would say 150%
    expect(attainmentOfShare(160, 480, 1)).toBe(1)
  })

  it('pins the needle but keeps the real value for the readout', () => {
    expect(pinned(1.34, 1.2)).toBe(1.2)
    expect(formatPercent(1.34)).toBe('134%')
    expect(pinned(-0.1, 1.2)).toBe(0)
    expect(pinned(null, 1.2)).toBeNull()
  })
})

describe('pace', () => {
  it('expected-to-date is quarter target × elapsed ÷ 3', () => {
    expect(expectedToDate(M(4_000_000), 1)).toBe(M(1_333_333.33))
    expect(expectedToDate(M(4_000_000), 2)).toBe(M(2_666_666.67))
    expect(expectedToDate(480, 3)).toBe(480)
    expect(expectedToDate(null, 2)).toBeNull()
  })

  it.each([
    [1.25, 'ahead'],
    [1.0, 'on_pace'],
    [0.99, 'at_risk'],
    [0.7, 'at_risk'],
    [0.699, 'behind'],
    [0, 'behind'],
  ])('%d of expected is %s', (ratio, status) => {
    expect(paceStatus(ratio, true, DEFAULT_SETTINGS)).toBe(status)
  })

  it('has its own states for no target and no data', () => {
    expect(paceStatus(null, true, DEFAULT_SETTINGS)).toBe('no_target')
    expect(paceStatus(0.5, false, DEFAULT_SETTINGS)).toBe('no_data')
  })

  it('uses configurable thresholds', () => {
    const strict = { onPace: 1.1, atRisk: 0.9 }
    expect(paceStatus(1.0, true, strict)).toBe('at_risk')
    expect(paceStatus(0.85, true, strict)).toBe('behind')
  })
})

describe('catch-up is cumulative and never negative', () => {
  const target = M(3_000_000) // ₱1,000,000 a month

  it('carries each month’s shortfall forward', () => {
    // October 600K (short 400K), November 700K (short 300K more) → 700K
    expect(catchUp(M(600_000), target, 1)).toBe(M(400_000))
    expect(catchUp(M(600_000 + 700_000), target, 2)).toBe(M(700_000))
  })

  it('lets a surplus offset a later shortfall', () => {
    // October 1.2M (+200K), November 900K (−100K) → still 100K ahead → 0
    expect(catchUp(M(1_200_000 + 900_000), target, 2)).toBe(0)
  })

  it('is zero, not negative, when ahead', () => {
    expect(catchUp(M(5_000_000), target, 1)).toBe(0)
  })

  it('rounds calls catch-up up to a whole call', () => {
    expect(callsCatchUp(100, 481, 1)).toBe(61) // 160.33 expected
    expect(callsCatchUp(200, 480, 1)).toBe(0)
  })

  it('needs a target', () => {
    expect(catchUp(M(1), null, 1)).toBeNull()
  })
})

describe('projection', () => {
  it('extends the run rate to the quarter', () => {
    const p = projection(M(800_000), M(3_000_000), 1)
    expect(p.amount).toBe(M(2_400_000))
    expect(p.attainment).toBeCloseTo(0.8, 10)
  })

  it('says nothing before any month has data', () => {
    expect(projection(0, M(3_000_000), 0)).toEqual({ amount: null, attainment: null })
  })
})

describe('targets come from data, never from code', () => {
  const person = {
    personId: 'p1',
    position: 'psr' as const,
    area: 'caraga' as const,
    fileTargets: { inhouse: M(3_000_000), ethical: M(1_500_000), combi: M(4_000_000), calls: 480 },
  }
  const admin = (t: Partial<AdminTarget>): AdminTarget => ({
    scope: 'position', personId: null, position: 'psr', area: null,
    inhouse: null, ethical: null, combi: null, calls: null, ...t,
  })

  it('honours the workbook combi target as written and flags the mismatch (open question 1)', () => {
    const resolved = resolveTargets(person, [], DEFAULT_SETTINGS)
    expect(resolved.values.combi).toBe(M(4_000_000))
    expect(resolved.partsMismatch).toBe(true)
    expect(resolved.sources).toEqual({ inhouse: 'file', ethical: 'file', combi: 'file', calls: 'file' })
  })

  it('lets an admin override one field for one person', () => {
    const resolved = resolveTargets(person, [admin({ scope: 'person', personId: 'p1', position: null, combi: M(4_500_000) })], DEFAULT_SETTINGS)
    expect(resolved.values.combi).toBe(M(4_500_000))
    expect(resolved.sources.combi).toBe('person')
    expect(resolved.sources.inhouse).toBe('file')
    expect(resolved.partsMismatch).toBe(false)
  })

  it('fills gaps from position+area, then position defaults', () => {
    const noFile = { ...person, fileTargets: { inhouse: null, ethical: null, combi: null, calls: null } }
    const resolved = resolveTargets(
      noFile,
      [admin({ calls: 450 }), admin({ scope: 'position_area', area: 'caraga', inhouse: M(2_000_000), ethical: M(1_000_000) })],
      DEFAULT_SETTINGS,
    )
    expect(resolved.values).toEqual({ inhouse: M(2_000_000), ethical: M(1_000_000), combi: M(3_000_000), calls: 450 })
    expect(resolved.sources).toEqual({ inhouse: 'position_area', ethical: 'position_area', combi: 'derived', calls: 'position' })
  })

  it('can leave combi unset instead of deriving it', () => {
    const parts = { ...person, fileTargets: { ...person.fileTargets, combi: null } }
    expect(resolveTargets(parts, [], { ...DEFAULT_SETTINGS, combiFallback: 'none' }).values.combi).toBeNull()
  })

  it('reads a monthly calls target (160) as 480 a quarter when configured (open question 3)', () => {
    const monthly = { ...person, fileTargets: { ...person.fileTargets, calls: 160 } }
    expect(resolveTargets(monthly, [], { ...DEFAULT_SETTINGS, fileCallsBasis: 'month' }).values.calls).toBe(480)
  })
})
