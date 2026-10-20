import type { PersonMetrics } from './aggregate'

/* ---------------------------------------------------------------------------
 * RANKING
 *
 * Competition ranking: equal values share a rank and the next rank skips
 * (1, 2, 2, 4). Two rules on top:
 *   - Zero-value people form one tied group BELOW everyone with data, even
 *     someone net negative from returns — doing nothing never outranks doing
 *     something.
 *   - People without a value (no target for a % metric, or not measured at
 *     all) are unranked and listed after everyone ranked.
 * ------------------------------------------------------------------------- */

export type RankMetric = 'combi' | 'inhouse' | 'ethical' | 'calls' | 'combi_pct'

export const RANK_METRIC_LABEL: Record<RankMetric, string> = {
  combi: 'combi',
  inhouse: 'in-house',
  ethical: 'ethical',
  calls: 'calls',
  combi_pct: 'combi attainment',
}

export interface Ranked<T> {
  item: T
  value: number | null
  rank: number | null
}

/** Lower tier sorts first: people with data, then zeros, then unranked. */
const tier = (value: number | null) => (value === null ? 2 : value === 0 ? 1 : 0)

export function rankBy<T>(items: readonly T[], valueOf: (item: T) => number | null, nameOf?: (item: T) => string): Ranked<T>[] {
  const sorted = items
    .map((item) => ({ item, value: valueOf(item) }))
    .sort((a, b) => {
      const byTier = tier(a.value) - tier(b.value)
      if (byTier) return byTier
      if (a.value !== null && b.value !== null && a.value !== b.value) return b.value - a.value
      return nameOf ? nameOf(a.item).localeCompare(nameOf(b.item)) : 0
    })

  let rank = 0
  let previous: number | null | undefined
  return sorted.map((entry, index) => {
    if (entry.value === null) return { ...entry, rank: null }
    if (entry.value !== previous) {
      rank = index + 1
      previous = entry.value
    }
    return { ...entry, rank }
  })
}

/** The value a person is ranked on. Unmeasured people (no target) are never ranked. */
export function rankValue(person: PersonMetrics, metric: RankMetric): number | null {
  if (!person.measured || !person.hasData) return null
  switch (metric) {
    case 'combi_pct':
      return person.attainment.combi
    case 'calls':
      return person.actual.calls
    default:
      return person.actual[metric]
  }
}

export function rankPeople(people: readonly PersonMetrics[], metric: RankMetric): Ranked<PersonMetrics>[] {
  return rankBy(people, (p) => rankValue(p, metric), (p) => `${p.lastName} ${p.firstName}`)
}

/**
 * Top N keeps ties at the cut (Top 3 of 1, 2, 3, 3 shows four people, both
 * rank 3s). Bottom N — "needs attention" — is the same from the other end,
 * worst first. Unranked people are in neither.
 */
export function selectTop<T>(ranked: readonly Ranked<T>[], n: number | 'all', direction: 'top' | 'bottom'): Ranked<T>[] {
  const eligible = ranked.filter((r) => r.rank !== null)
  if (n === 'all') return direction === 'top' ? eligible : [...eligible].reverse()
  if (direction === 'top') {
    return eligible.filter((r) => r.rank! <= n)
  }
  const worstFirst = [...eligible].reverse()
  if (worstFirst.length <= n) return worstFirst
  const cutValue = worstFirst[n - 1].value
  return worstFirst.filter((r, index) => index < n || r.value === cutValue)
}
