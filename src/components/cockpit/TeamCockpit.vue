<script setup lang="ts">
import { computed } from 'vue'
import CockpitHeading from './CockpitHeading.vue'
import CockpitCluster from './CockpitCluster.vue'
import CockpitEmpty from './CockpitEmpty.vue'
import StandingsRail from './StandingsRail.vue'
import TrendLines from './TrendLines.vue'
import InstrumentSkeleton from '@/components/instruments/InstrumentSkeleton.vue'
import { useCockpitFilters } from '@/composables/useCockpitFilters'
import { useCockpitData } from '@/composables/useCockpitData'
import { useTrends } from '@/composables/useTrends'
import { useSalesStore } from '@/stores/sales'
import { teamReading } from '@/lib/cockpit/reading'
import { METRIC_LABEL, monthName, summaryLine } from '@/lib/cockpit/filters'
import { elapsedMonths } from '@/lib/metrics'

defineProps<{ wall?: boolean }>()

const sales = useSalesStore()
const { filters, query, reset } = useCockpitFilters()
const cockpit = useCockpitData(filters)
const { loading, error, data, period, calendarMonths, monthsWithData, selection, expectedShare, filtered, team, telltales, standings, highlighted, hasPeriods } = cockpit

const quarter = computed(() => period.value?.quarter ?? null)
const trends = useTrends(filters, filtered, cockpit.context, quarter)

const periodLabel = computed(() =>
  selection.value.kind === 'month' ? monthName(calendarMonths.value, selection.value.month) : `Q${quarter.value} to date`,
)

const byWhen = computed(() => {
  const end = selection.value.kind === 'month' ? selection.value.month : elapsedMonths(monthsWithData.value)
  return end ? `end of ${monthName(calendarMonths.value, end as 1 | 2 | 3)}` : 'now'
})

const reading = computed(() => teamReading(team.value, expectedShare.value, selection.value.kind === 'month', sales.settings, telltales.value))

const line = computed(() => summaryLine(filters.value, quarter.value, calendarMonths.value))
const quarterName = computed(() => (period.value ? `Q${period.value.quarter} ${period.value.year}` : 'this quarter'))
const subject = computed(() => `${team.value.headcount} ${team.value.headcount === 1 ? 'person' : 'people'} in view`)

const monthHasNoData = computed(
  () => !!data.value && selection.value.kind === 'month' && !monthsWithData.value.includes(selection.value.month),
)
</script>

<template>
  <div class="cockpit" :class="{ 'cockpit--wall': wall }" data-testid="team-cockpit">
    <CockpitHeading title="Team cockpit" :summary="data?.summary ?? null" :calendar-months="calendarMonths" :line="line">
      <template #actions><slot name="actions" /></template>
    </CockpitHeading>

    <slot name="filters" :headcount="cockpit.headcount.value" :calendar-months="calendarMonths" :months-with-data="monthsWithData" />

    <InstrumentSkeleton v-if="loading && !data" />
    <CockpitEmpty v-else-if="error" kind="error" :message="error" />
    <CockpitEmpty v-else-if="!hasPeriods || !data" kind="no-upload" :quarter="quarterName" />
    <CockpitEmpty v-else-if="!filtered.length" kind="no-match" @reset="reset" />

    <template v-else>
      <p v-if="monthHasNoData" class="cockpit__notice" role="status">
        <v-icon icon="mdi-clock-outline" size="16" /> {{ periodLabel }} has no data yet. The instruments are at rest, not at zero.
      </p>

      <div class="cockpit__body">
        <CockpitCluster
          :reading="reading"
          :settings="sales.settings"
          :period-label="periodLabel"
          :by-when="byWhen"
          :quarter-label="`Q${quarter}`"
          :subject="subject"
        />
        <StandingsRail
          v-if="!wall"
          class="cockpit__rail"
          :standings="standings"
          :highlighted="highlighted"
          :metric="filters.metric"
          :query="query"
          :title="`Standings · ${METRIC_LABEL[filters.metric]}`"
        />
      </div>

      <section v-if="!wall" class="cockpit__trends" aria-label="Trends">
        <TrendLines title="Team combi attainment by month" :labels="trends.monthLabels.value" :series="trends.teamMonths.value" />
        <TrendLines title="By area, by month" :labels="trends.monthLabels.value" :series="trends.areaMonths.value" />
        <TrendLines
          v-if="trends.quarters.value.enough"
          title="Quarter to date, quarter by quarter"
          :labels="trends.quarters.value.labels"
          :series="trends.quarters.value.series"
        />
        <p v-else class="cockpit__trend-note">
          The quarter-by-quarter line appears once a second quarter has been uploaded.
        </p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.cockpit {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}

.cockpit__notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px dashed rgb(var(--v-theme-line-strong));
  border-radius: 6px;
  font-size: 0.875rem;
  color: rgb(var(--v-theme-ink-2));
}

.cockpit__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 24px;
  align-items: start;
}

.cockpit--wall .cockpit__body {
  grid-template-columns: minmax(0, 1fr);
}

.cockpit__trends {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px 32px;
  padding-top: 24px;
  border-top: 1px solid rgb(var(--v-theme-line));
}

.cockpit__trend-note {
  align-self: center;
  font-size: 0.875rem;
  color: rgb(var(--v-theme-ink-2));
}

@media (max-width: 1280px) {
  .cockpit__body {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 800px) {
  .cockpit__trends {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* Wide tables scroll inside their own frame, never the page. */
.cockpit > * {
  min-width: 0;
}
</style>
