import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import { useSalesStore, parsePeriodKey, periodKey, type PeriodData } from '@/stores/sales'
import { calendarMonthsOf } from '@/lib/excel/period'
import { AREAS, selectionOf, type CockpitFilters } from '@/lib/cockpit/filters'
import { elapsedMonths, personMetrics, rankPeople, selectTop, teamMetrics, teamTellTales, type MetricContext, type PersonMetrics, type Ranked } from '@/lib/metrics'
import { normalizeNamePart } from '@/lib/excel/names'
import type { Area, QuarterMonth } from '@/types'

/**
 * Everything a cockpit view computes from the filters: the quarter's snapshot,
 * every person's metrics, the filtered set, the team aggregate, and the
 * standings. Recomputes when the filters change or when the sales store says
 * the data did (a commit, a restore, a target edit — from any tab).
 */
export function useCockpitData(filters: Ref<CockpitFilters>) {
  const sales = useSalesStore()
  const period = computed(() => parsePeriodKey(filters.value.period) ?? (sales.latest ? { year: sales.latest.year, quarter: sales.latest.quarter } : null))
  const key = computed(() => (period.value ? periodKey(period.value.year, period.value.quarter) : null))

  // Paint from memory first. Coming back to a view, or switching between
  // views, shows the cockpit at once instead of a skeleton.
  const cached = () => (period.value ? sales.peek(period.value.year, period.value.quarter) : null)
  const data = shallowRef<PeriodData | null>(cached())
  /** True only while there is nothing to show yet. Background refreshes keep the old view up. */
  const loading = ref(data.value === null)
  const error = ref<string | null>(null)

  async function load() {
    error.value = null
    data.value = cached() ?? data.value
    loading.value = data.value === null
    try {
      await sales.initialize()
      const target = period.value
      data.value = target ? await sales.loadPeriod(target.year, target.quarter) : null
    } catch (caught) {
      // A failed background refresh keeps the last good view on screen.
      if (data.value) console.warn('[cockpit] Refresh failed; showing the last loaded data.', caught)
      else error.value = caught instanceof Error ? caught.message : 'Could not load the cockpit.'
    } finally {
      loading.value = false
    }
  }

  watch([key, () => sales.revision], load, { immediate: true })

  const calendarMonths = computed(() => (period.value ? calendarMonthsOf(period.value.quarter) : null))
  const monthsWithData = computed<QuarterMonth[]>(() => data.value?.summary.monthsWithData ?? [])
  const selection = computed(() => selectionOf(filters.value.span))

  const context = computed<MetricContext>(() => ({
    selection: selection.value,
    monthsWithData: monthsWithData.value,
    settings: sales.settings,
    adminTargets: data.value?.adminTargets ?? [],
  }))

  /** Share of the quarter expected by the end of the selection (1 for a month). */
  const expectedShare = computed(() =>
    selection.value.kind === 'month' ? 1 : Math.max(elapsedMonths(monthsWithData.value), 1) / 3,
  )

  const everyone = computed<PersonMetrics[]>(() => (data.value?.people ?? []).map((p) => personMetrics(p, context.value)))

  const search = computed(() => normalizeNamePart(filters.value.q))
  const matchesSearch = (p: PersonMetrics) =>
    !search.value || normalizeNamePart(`${p.firstName} ${p.lastName}`).includes(search.value) ||
    normalizeNamePart(`${p.lastName} ${p.firstName}`).includes(search.value)

  /** Role + search, before areas — what the area chips count. */
  const byRole = computed(() => everyone.value.filter((p) => filters.value.roles.includes(p.position) && matchesSearch(p)))

  const filtered = computed(() =>
    byRole.value.filter((p) => !filters.value.areas.length || filters.value.areas.includes(p.area)),
  )

  const headcount = computed(() => {
    const counts = Object.fromEntries(AREAS.map((a) => [a, 0])) as Record<Area, number>
    for (const p of byRole.value) if (p.area in counts) counts[p.area]++
    return { ...counts, all: byRole.value.length, selected: filtered.value.length }
  })

  const team = computed(() => teamMetrics(filtered.value, context.value))
  const telltales = computed(() => teamTellTales(team.value, filtered.value, sales.settings))

  const ranked = computed(() => rankPeople(filtered.value, filters.value.metric))

  /** Standings order: best first, or worst first for "needs attention"; unranked always last. */
  const standings = computed<Ranked<PersonMetrics>[]>(() => {
    if (filters.value.dir === 'top') return ranked.value
    const rankedOnly = ranked.value.filter((r) => r.rank !== null).reverse()
    return [...rankedOnly, ...ranked.value.filter((r) => r.rank === null)]
  })

  const highlighted = computed(() => new Set(selectTop(ranked.value, filters.value.top, filters.value.dir).map((r) => r.item.personId)))

  const hasPeriods = computed(() => sales.periods.length > 0)

  return {
    loading,
    error,
    data,
    period,
    calendarMonths,
    monthsWithData,
    selection,
    expectedShare,
    context,
    everyone,
    filtered,
    headcount,
    team,
    telltales,
    ranked,
    standings,
    highlighted,
    hasPeriods,
    reload: load,
  }
}
