import type { QuarterMonth } from '@/types/sales'
import { attainment, attainmentOfShare } from './attainment'
import { callsCatchUp, catchUp, elapsedMonths, expectedToDate, paceStatus, projection } from './pace'
import { isMeasured, resolveTargets, type ResolvedTargets } from './targets'
import type {
  AdminTarget,
  Attainments,
  MetricSettings,
  MetricValues,
  MonthInputs,
  PaceStatus,
  PeriodSelection,
  PersonPeriod,
  TargetValues,
} from './types'
import type { Centavos } from './money'

/* ---------------------------------------------------------------------------
 * AGGREGATES for a period selection.
 *
 * Quarter-to-date: actual through the latest month with data, against the
 *   QUARTER target (so October alone reads as roughly a third, by design),
 *   with pace telling you whether that third is on schedule.
 * One month: that month against a third of the quarter target. Catch-up is
 *   still cumulative through that month — the workbook's own definition.
 *
 * Team rule (open question 2): totals count everyone in the filtered set;
 * attainment and pace count only people with targets.
 * ------------------------------------------------------------------------- */

export interface MetricContext {
  selection: PeriodSelection
  monthsWithData: readonly QuarterMonth[]
  settings: MetricSettings
  adminTargets: readonly AdminTarget[]
}

export interface MonthTrend {
  month: QuarterMonth
  hasData: boolean
  values: MetricValues | null
  /** Against a third of the quarter target. */
  attainment: Attainments
}

export interface PaceReading {
  ratio: number | null
  status: PaceStatus
  /** What should have been done by now, for display. */
  expected: number | null
}

export interface PersonMetrics {
  personId: string
  lastName: string
  firstName: string
  name: string
  position: PersonPeriod['position']
  area: PersonPeriod['area']
  targets: ResolvedTargets
  measured: boolean
  hasData: boolean
  /** The selection: quarter-to-date sum, or the one month. */
  actual: MetricValues
  /** Cumulative through the end of the selection (equals actual for QTD). */
  toDate: MetricValues
  attainment: Attainments
  pace: PaceReading
  callsPace: PaceReading
  catchUp: { combi: Centavos | null; inhouse: Centavos | null; ethical: Centavos | null; calls: number | null }
  projection: { amount: Centavos | null; attainment: number | null }
  months: MonthTrend[]
}

export interface TeamMetrics {
  headcount: number
  measuredCount: number
  hasData: boolean
  totals: MetricValues
  measuredActual: MetricValues
  measuredToDate: MetricValues
  targets: TargetValues
  attainment: Attainments
  pace: PaceReading
  callsPace: PaceReading
  catchUp: PersonMetrics['catchUp']
  projection: PersonMetrics['projection']
  months: MonthTrend[]
}

const ZERO: MetricValues = { inhouse: 0, ethical: 0, combi: 0, calls: 0 }
const MONTHS: QuarterMonth[] = [1, 2, 3]

const valuesOf = (inputs: MonthInputs | undefined): MetricValues =>
  inputs ? { inhouse: inputs.inhouse, ethical: inputs.ethical, combi: inputs.inhouse + inputs.ethical, calls: inputs.calls } : ZERO

const add = (a: MetricValues, b: MetricValues): MetricValues => ({
  inhouse: a.inhouse + b.inhouse,
  ethical: a.ethical + b.ethical,
  combi: a.combi + b.combi,
  calls: a.calls + b.calls,
})

/** Which month the selection runs to, and whether it has any data. */
export function selectionWindow(ctx: Pick<MetricContext, 'selection' | 'monthsWithData'>): { end: number; hasData: boolean } {
  if (ctx.selection.kind === 'month') {
    return { end: ctx.selection.month, hasData: ctx.monthsWithData.includes(ctx.selection.month) }
  }
  const end = elapsedMonths(ctx.monthsWithData)
  return { end, hasData: end > 0 }
}

function sumMonths(months: PersonPeriod['months'], through: number, ctx: MetricContext): MetricValues {
  return MONTHS.filter((m) => m <= through && ctx.monthsWithData.includes(m)).reduce(
    (sum, m) => add(sum, valuesOf(months[m])),
    ZERO,
  )
}

/** Attainment of `actual` for the selection: quarter target for QTD, a third for one month. */
function attainmentsFor(actual: MetricValues, targets: TargetValues, selection: PeriodSelection): Attainments {
  const of = (value: number, target: number | null) =>
    selection.kind === 'qtd' ? attainment(value, target) : attainmentOfShare(value, target, 1)
  return {
    inhouse: of(actual.inhouse, targets.inhouse),
    ethical: of(actual.ethical, targets.ethical),
    combi: of(actual.combi, targets.combi),
    calls: of(actual.calls, targets.calls),
  }
}

function readPace(
  toDate: number,
  monthValue: number,
  target: number | null,
  end: number,
  hasData: boolean,
  ctx: MetricContext,
  thresholds: Pick<MetricSettings, 'onPace' | 'atRisk'>,
): PaceReading {
  if (ctx.selection.kind === 'month') {
    const ratio = attainmentOfShare(monthValue, target, 1)
    return { ratio, status: paceStatus(ratio, hasData, thresholds), expected: expectedToDate(target, 1) }
  }
  const ratio = attainmentOfShare(toDate, target, end)
  return { ratio, status: paceStatus(ratio, hasData, thresholds), expected: expectedToDate(target, end) }
}

function trend(months: PersonPeriod['months'] | null, totals: Partial<Record<QuarterMonth, MetricValues>> | null, targets: TargetValues, ctx: MetricContext): MonthTrend[] {
  return MONTHS.map((month) => {
    const hasData = ctx.monthsWithData.includes(month)
    const values = !hasData ? null : months ? valuesOf(months[month]) : (totals?.[month] ?? ZERO)
    return {
      month,
      hasData,
      values,
      attainment: values ? attainmentsFor(values, targets, { kind: 'month', month }) : { inhouse: null, ethical: null, combi: null, calls: null },
    }
  })
}

export function personMetrics(person: PersonPeriod, ctx: MetricContext): PersonMetrics {
  const targets = resolveTargets(person, ctx.adminTargets, ctx.settings)
  const { end, hasData } = selectionWindow(ctx)
  const toDate = sumMonths(person.months, end, ctx)
  const actual = ctx.selection.kind === 'month' ? (hasData ? valuesOf(person.months[ctx.selection.month]) : ZERO) : toDate
  const t = targets.values

  return {
    personId: person.personId,
    lastName: person.lastName,
    firstName: person.firstName,
    name: `${person.firstName} ${person.lastName}`,
    position: person.position,
    area: person.area,
    targets,
    measured: isMeasured(t, ctx.settings),
    hasData,
    actual,
    toDate,
    attainment: hasData ? attainmentsFor(actual, t, ctx.selection) : { inhouse: null, ethical: null, combi: null, calls: null },
    pace: readPace(toDate.combi, actual.combi, t.combi, end, hasData, ctx, ctx.settings),
    callsPace: readPace(toDate.calls, actual.calls, t.calls, end, hasData, ctx, ctx.settings),
    catchUp: hasData
      ? {
          combi: catchUp(toDate.combi, t.combi, end),
          inhouse: catchUp(toDate.inhouse, t.inhouse, end),
          ethical: catchUp(toDate.ethical, t.ethical, end),
          calls: callsCatchUp(toDate.calls, t.calls, end),
        }
      : { combi: null, inhouse: null, ethical: null, calls: null },
    projection: hasData ? projection(toDate.combi, t.combi, end) : { amount: null, attainment: null },
    months: trend(person.months, null, t, ctx),
  }
}

/** Sum each target field over the people who have it. */
function sumTargets(people: readonly PersonMetrics[]): TargetValues {
  const sum = (field: keyof TargetValues) => {
    const set = people.map((p) => p.targets.values[field]).filter((v): v is number => v !== null)
    return set.length ? set.reduce((a, b) => a + b, 0) : null
  }
  return { inhouse: sum('inhouse'), ethical: sum('ethical'), combi: sum('combi'), calls: sum('calls') }
}

/** Actuals of only the people who have a target for that field, so the ratio compares like with like. */
function actualWhereTargeted(people: readonly PersonMetrics[], pick: (p: PersonMetrics) => MetricValues): MetricValues {
  const part = (field: keyof MetricValues) =>
    people.filter((p) => p.targets.values[field] !== null).reduce((sum, p) => sum + pick(p)[field], 0)
  return { inhouse: part('inhouse'), ethical: part('ethical'), combi: part('combi'), calls: part('calls') }
}

export function teamMetrics(people: readonly PersonMetrics[], ctx: MetricContext): TeamMetrics {
  const { end, hasData } = selectionWindow(ctx)
  const measured = people.filter((p) => p.measured)
  const totals = people.reduce((sum, p) => add(sum, p.actual), ZERO)
  const measuredActual = measured.reduce((sum, p) => add(sum, p.actual), ZERO)
  const measuredToDate = measured.reduce((sum, p) => add(sum, p.toDate), ZERO)
  const targets = sumTargets(measured)
  const actualTargeted = actualWhereTargeted(measured, (p) => p.actual)
  const toDateTargeted = actualWhereTargeted(measured, (p) => p.toDate)

  const monthTotals: Partial<Record<QuarterMonth, MetricValues>> = {}
  for (const month of MONTHS) {
    monthTotals[month] = actualWhereTargeted(measured, (p) => p.months[month - 1].values ?? ZERO)
  }

  return {
    headcount: people.length,
    measuredCount: measured.length,
    hasData,
    totals,
    measuredActual,
    measuredToDate,
    targets,
    attainment: hasData ? attainmentsFor(actualTargeted, targets, ctx.selection) : { inhouse: null, ethical: null, combi: null, calls: null },
    pace: readPace(toDateTargeted.combi, actualTargeted.combi, targets.combi, end, hasData, ctx, ctx.settings),
    callsPace: readPace(toDateTargeted.calls, actualTargeted.calls, targets.calls, end, hasData, ctx, ctx.settings),
    catchUp: hasData
      ? {
          combi: catchUp(toDateTargeted.combi, targets.combi, end),
          inhouse: catchUp(toDateTargeted.inhouse, targets.inhouse, end),
          ethical: catchUp(toDateTargeted.ethical, targets.ethical, end),
          calls: callsCatchUp(toDateTargeted.calls, targets.calls, end),
        }
      : { combi: null, inhouse: null, ethical: null, calls: null },
    projection: hasData ? projection(toDateTargeted.combi, targets.combi, end) : { amount: null, attainment: null },
    months: trend(null, monthTotals, targets, ctx),
  }
}
