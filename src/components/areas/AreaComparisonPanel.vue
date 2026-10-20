<script setup lang="ts">
import { computed } from 'vue'
import CockpitHeading from '@/components/cockpit/CockpitHeading.vue'
import CockpitEmpty from '@/components/cockpit/CockpitEmpty.vue'
import AreaComparison from './AreaComparison.vue'
import InstrumentSkeleton from '@/components/instruments/InstrumentSkeleton.vue'
import { useCockpitFilters } from '@/composables/useCockpitFilters'
import { useCockpitData } from '@/composables/useCockpitData'
import { summaryLine } from '@/lib/cockpit/filters'

const { filters, query } = useCockpitFilters()
const cockpit = useCockpitData(filters)
const { loading, error, data, period, calendarMonths, monthsWithData, everyone, context, expectedShare, hasPeriods } = cockpit

const line = computed(() => summaryLine(filters.value, period.value?.quarter ?? null, calendarMonths.value))
</script>

<template>
  <div class="areas-panel">
    <CockpitHeading title="Area comparison" :summary="data?.summary ?? null" :calendar-months="calendarMonths" :line="line" />
    <slot name="filters" :headcount="cockpit.headcount.value" :calendar-months="calendarMonths" :months-with-data="monthsWithData" />

    <InstrumentSkeleton v-if="loading && !data" />
    <CockpitEmpty v-else-if="error" kind="error" :message="error" />
    <CockpitEmpty v-else-if="!hasPeriods || !data" kind="no-upload" />
    <AreaComparison v-else :everyone="everyone" :filters="filters" :context="context" :expected-share="expectedShare" :query="query" />
  </div>
</template>

<style scoped>
.areas-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}

/* Wide tables scroll inside their own frame, never the page. */
.areas-panel > * {
  min-width: 0;
}
</style>
