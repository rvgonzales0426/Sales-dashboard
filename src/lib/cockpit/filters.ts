import type { Area, Position, QuarterMonth } from '@/types/sales'
import type { PeriodSelection } from '@/lib/metrics/types'
import { RANK_METRIC_LABEL, type RankMetric } from '@/lib/metrics/rank'
import { MONTH_NAMES } from '@/lib/excel/headers'

/* ---------------------------------------------------------------------------
 * COCKPIT FILTERS — one state, kept in the URL so a view can be shared and
 * survives a refresh:
 *
 *   /?pq=2026-Q4&area=north,caraga&role=psr&span=qtd&top=5&metric=combi&dir=top&q=cruz
 *
 * Defaults are left out of the URL, so the plain address is the default view.
 * ------------------------------------------------------------------------- */

export type Span = 'qtd' | 'm1' | 'm2' | 'm3'
export type TopN = 3 | 5 | 10 | 'all'
export type Direction = 'top' | 'bottom'

export interface CockpitFilters {
  /** "2026-Q4"; null means the latest quarter with an upload. */
  period: string | null
  /** Empty means all areas. */
  areas: Area[]
  roles: Position[]
  span: Span
  top: TopN
  metric: RankMetric
  dir: Direction
  q: string
}

export const AREAS: Area[] = ['north', 'south', 'caraga']
export const ROLES: Position[] = ['psr', 'supervisor', 'group_head']
export const METRICS: RankMetric[] = ['combi', 'inhouse', 'ethical', 'calls', 'combi_pct']
export const TOPS: TopN[] = [3, 5, 10, 'all']

export const AREA_LABEL: Record<Area, string> = { north: 'North', south: 'South', caraga: 'Caraga', na: 'N/A' }
export const ROLE_LABEL: Record<Position, string> = { psr: 'PSR', supervisor: 'Supervisor', group_head: 'Group head' }
export const METRIC_LABEL: Record<RankMetric, string> = {
  combi: 'Combi collected',
  inhouse: 'In-house',
  ethical: 'Ethical',
  calls: 'Calls',
  combi_pct: 'Combi attainment %',
}

export const DEFAULT_FILTERS: CockpitFilters = {
  period: null,
  areas: [],
  roles: ['psr'],
  span: 'qtd',
  top: 5,
  metric: 'combi',
  dir: 'top',
  q: '',
}

type Query = Record<string, string | null | (string | null)[] | undefined>

const first = (value: Query[string]) => (Array.isArray(value) ? value[0] : value) ?? null
const list = (value: Query[string]) =>
  (first(value) ?? '')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)

/** Lenient: anything unrecognised falls back to the default rather than erroring. */
export function parseFilters(query: Query): CockpitFilters {
  const period = first(query.pq)
  const areas = list(query.area).filter((a): a is Area => (AREAS as string[]).includes(a))
  const roles = list(query.role).filter((r): r is Position => (ROLES as string[]).includes(r))
  const span = first(query.span)
  const top = first(query.top)
  const metric = first(query.metric)
  const dir = first(query.dir)
  return {
    period: period && /^\d{4}-Q[1-4]$/.test(period) ? period : null,
    areas: areas.length === AREAS.length ? [] : [...new Set(areas)],
    roles: roles.length ? [...new Set(roles)] : DEFAULT_FILTERS.roles,
    span: span === 'm1' || span === 'm2' || span === 'm3' || span === 'qtd' ? span : DEFAULT_FILTERS.span,
    top: top === 'all' ? 'all' : top === '3' ? 3 : top === '10' ? 10 : top === '5' ? 5 : DEFAULT_FILTERS.top,
    metric: (METRICS as string[]).includes(metric ?? '') ? (metric as RankMetric) : DEFAULT_FILTERS.metric,
    dir: dir === 'bottom' ? 'bottom' : 'top',
    q: (first(query.q) ?? '').slice(0, 80),
  }
}

/** Only what differs from the defaults goes in the URL. */
export function serializeFilters(filters: CockpitFilters): Record<string, string> {
  const out: Record<string, string> = {}
  if (filters.period) out.pq = filters.period
  if (filters.areas.length && filters.areas.length < AREAS.length) out.area = filters.areas.join(',')
  const roles = [...filters.roles].sort().join(',')
  if (roles !== [...DEFAULT_FILTERS.roles].sort().join(',')) out.role = filters.roles.join(',')
  if (filters.span !== DEFAULT_FILTERS.span) out.span = filters.span
  if (filters.top !== DEFAULT_FILTERS.top) out.top = String(filters.top)
  if (filters.metric !== DEFAULT_FILTERS.metric) out.metric = filters.metric
  if (filters.dir !== DEFAULT_FILTERS.dir) out.dir = filters.dir
  if (filters.q.trim()) out.q = filters.q.trim()
  return out
}

export function selectionOf(span: Span): PeriodSelection {
  return span === 'qtd' ? { kind: 'qtd' } : { kind: 'month', month: Number(span.slice(1)) as QuarterMonth }
}

export function monthName(calendarMonths: readonly number[] | null, month: QuarterMonth): string {
  const calendar = calendarMonths?.[month - 1]
  return calendar ? MONTH_NAMES[calendar - 1] : `Month ${month}`
}

/** "North + Caraga · PSR · Q4 total · Top 5 by combi" */
export function summaryLine(filters: CockpitFilters, quarter: number | null, calendarMonths: readonly number[] | null): string {
  const areas = filters.areas.length ? filters.areas.map((a) => AREA_LABEL[a]).join(' + ') : 'All areas'
  const roles = filters.roles.map((r) => ROLE_LABEL[r]).join(' + ')
  const period =
    filters.span === 'qtd'
      ? `Q${quarter ?? '?'} total`
      : monthName(calendarMonths, Number(filters.span.slice(1)) as QuarterMonth)
  const ranking =
    filters.top === 'all'
      ? `${filters.dir === 'top' ? 'Ranked' : 'Lowest first'} by ${RANK_METRIC_LABEL[filters.metric]}`
      : `${filters.dir === 'top' ? 'Top' : 'Bottom'} ${filters.top} by ${RANK_METRIC_LABEL[filters.metric]}`
  const search = filters.q.trim() ? ` · “${filters.q.trim()}”` : ''
  return `${areas} · ${roles} · ${period} · ${ranking}${search}`
}

export function isDefault(filters: CockpitFilters): boolean {
  return Object.keys(serializeFilters({ ...filters, period: null })).length === 0
}
