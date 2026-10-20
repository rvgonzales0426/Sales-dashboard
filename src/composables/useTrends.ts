import { computed, ref, watch, type Ref } from 'vue'
import { useSalesStore, type PeriodData } from '@/stores/sales'
import { calendarMonthsOf } from '@/lib/excel/period'
import { MONTH_NAMES } from '@/lib/excel/headers'
import { AREA_LABEL, AREAS, type CockpitFilters } from '@/lib/cockpit/filters'
import { personMetrics, teamMetrics, type MetricContext, type PersonMetrics } from '@/lib/metrics'
import type { TrendSeries } from '@/lib/cockpit/trend'
import type { Area, Quarter } from '@/types'

/**
 * Direction, not just a snapshot: month lines within the quarter (team or
 * one person, and per area) and quarter lines across every uploaded quarter.
 */
export function useTrends(
  filters: Ref<CockpitFilters>,
  people: Ref<PersonMetrics[]>,
  context: Ref<MetricContext>,
  quarter: Ref<Quarter | null>,
) {
  const sales = useSalesStore()
  const all = ref<PeriodData[]>([])

  watch(
    () => [sales.revision, sales.periods.length],
    async () => {
      all.value = await sales.loadAllPeriods().catch(() => [])
    },
    { immediate: true },
  )

  const monthLabels = computed(() =>
    quarter.value ? calendarMonthsOf(quarter.value).map((m) => MONTH_NAMES[m - 1].slice(0, 3)) : ['M1', 'M2', 'M3'],
  )

  /** Monthly context: each month against a third of the quarter target. */
  const monthly = computed<MetricContext>(() => ({ ...context.value, selection: { kind: 'qtd' } }))

  const teamMonths = computed<TrendSeries[]>(() => {
    const team = teamMetrics(people.value, monthly.value)
    return [{ key: 'team', label: 'Team', color: 'ink', values: team.months.map((m) => m.attainment.combi) }]
  })

  const areaMonths = computed<TrendSeries[]>(() => {
    const areas: Area[] = filters.value.areas.length ? filters.value.areas : AREAS
    return areas.map((area) => ({
      key: area,
      label: AREA_LABEL[area],
      color: `area-${area}`,
      values: teamMetrics(people.value.filter((p) => p.area === area), monthly.value).months.map((m) => m.attainment.combi),
    }))
  })

  function personMonths(person: PersonMetrics | null): TrendSeries[] {
    if (!person) return []
    return [{ key: person.personId, label: person.name, color: `area-${person.area}`, values: person.months.map((m) => m.attainment.combi) }]
  }

  /** Quarter-to-date attainment of the same filtered view, quarter by quarter. */
  const quarters = computed(() => {
    const chronological = [...all.value].sort((a, b) => a.summary.year - b.summary.year || a.summary.quarter - b.summary.quarter)
    const labels = chronological.map((p) => `Q${p.summary.quarter} ${String(p.summary.year).slice(2)}`)
    const series: TrendSeries[] = [
      {
        key: 'team',
        label: 'Team',
        color: 'ink',
        values: chronological.map((period) => {
          const ctx: MetricContext = {
            selection: { kind: 'qtd' },
            monthsWithData: period.summary.monthsWithData,
            settings: sales.settings,
            adminTargets: period.adminTargets,
          }
          const inView = period.people
            .map((p) => personMetrics(p, ctx))
            .filter((p) => filters.value.roles.includes(p.position) && (!filters.value.areas.length || filters.value.areas.includes(p.area)))
          return teamMetrics(inView, ctx).attainment.combi
        }),
      },
    ]
    return { labels, series, enough: chronological.length > 1 }
  })

  return { monthLabels, teamMonths, areaMonths, personMonths, quarters }
}
