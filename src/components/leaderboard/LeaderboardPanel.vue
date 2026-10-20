<script setup lang="ts">
import { computed } from 'vue'
import CockpitHeading from '@/components/cockpit/CockpitHeading.vue'
import CockpitEmpty from '@/components/cockpit/CockpitEmpty.vue'
import LeaderboardTable from './LeaderboardTable.vue'
import TableSkeleton from '@/components/common/TableSkeleton.vue'
import { useCockpitFilters } from '@/composables/useCockpitFilters'
import { useCockpitData } from '@/composables/useCockpitData'
import { summaryLine } from '@/lib/cockpit/filters'

const { filters, query, reset } = useCockpitFilters()
const cockpit = useCockpitData(filters)
const { loading, error, data, period, calendarMonths, monthsWithData, filtered, ranked, hasPeriods } = cockpit

const line = computed(() => summaryLine(filters.value, period.value?.quarter ?? null, calendarMonths.value))
const fileStem = computed(() =>
  period.value ? `leaderboard-${period.value.year}-Q${period.value.quarter}-${filters.value.span}` : 'leaderboard',
)
</script>

<template>
  <div class="leaderboard">
    <CockpitHeading title="Leaderboard" :summary="data?.summary ?? null" :calendar-months="calendarMonths" :line="line" />
    <slot name="filters" :headcount="cockpit.headcount.value" :calendar-months="calendarMonths" :months-with-data="monthsWithData" />

    <div v-if="loading && !data" class="surface-panel"><TableSkeleton :rows="8" :columns="7" /></div>
    <CockpitEmpty v-else-if="error" kind="error" :message="error" />
    <CockpitEmpty v-else-if="!hasPeriods || !data" kind="no-upload" />
    <CockpitEmpty v-else-if="!filtered.length" kind="no-match" @reset="reset" />
    <LeaderboardTable v-else :ranked="ranked" :filters="filters" :query="query" :summary="line" :file-stem="fileStem" />
  </div>
</template>

<style scoped>
.leaderboard {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}

/* Wide tables scroll inside their own frame, never the page. */
.leaderboard > * {
  min-width: 0;
}
</style>
