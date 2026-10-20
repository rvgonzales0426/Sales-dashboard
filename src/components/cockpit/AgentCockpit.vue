<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import CockpitHeading from './CockpitHeading.vue'
import CockpitCluster from './CockpitCluster.vue'
import CockpitEmpty from './CockpitEmpty.vue'
import TrendLines from './TrendLines.vue'
import AreaTag from './AreaTag.vue'
import InstrumentSkeleton from '@/components/instruments/InstrumentSkeleton.vue'
import { useCockpitFilters } from '@/composables/useCockpitFilters'
import { useCockpitData } from '@/composables/useCockpitData'
import { useTrends } from '@/composables/useTrends'
import { useSalesStore } from '@/stores/sales'
import { personReading } from '@/lib/cockpit/reading'
import { METRIC_LABEL, monthName, ROLE_LABEL, summaryLine } from '@/lib/cockpit/filters'
import { elapsedMonths, formatPercent, personTellTales, rankValue } from '@/lib/metrics'

const props = defineProps<{ personId: string }>()

const router = useRouter()
const sales = useSalesStore()
const { filters, query } = useCockpitFilters()
const cockpit = useCockpitData(filters)
const { loading, error, data, period, calendarMonths, monthsWithData, selection, expectedShare, everyone, standings, filtered } = cockpit
const quarter = computed(() => period.value?.quarter ?? null)
const trends = useTrends(filters, filtered, cockpit.context, quarter)

const person = computed(() => everyone.value.find((p) => p.personId === props.personId) ?? null)

/** Position in the filtered standings — the order ←/→ steps through. */
const index = computed(() => standings.value.findIndex((r) => r.item.personId === props.personId))
const entry = computed(() => (index.value >= 0 ? standings.value[index.value] : null))
const previous = computed(() => (index.value > 0 ? standings.value[index.value - 1].item : null))
const next = computed(() => (index.value >= 0 && index.value < standings.value.length - 1 ? standings.value[index.value + 1].item : null))

const periodLabel = computed(() =>
  selection.value.kind === 'month' ? monthName(calendarMonths.value, selection.value.month) : `Q${quarter.value} to date`,
)
const byWhen = computed(() => {
  const end = selection.value.kind === 'month' ? selection.value.month : elapsedMonths(monthsWithData.value)
  return end ? `end of ${monthName(calendarMonths.value, end as 1 | 2 | 3)}` : 'now'
})

const reading = computed(() =>
  person.value
    ? personReading(person.value, expectedShare.value, selection.value.kind === 'month', sales.settings, personTellTales(person.value, sales.settings))
    : null,
)

const rankText = computed(() => {
  if (!person.value) return ''
  if (!entry.value) return 'Outside the current filters'
  if (entry.value.rank === null) return 'Not ranked — no target set'
  const ranked = standings.value.filter((r) => r.rank !== null).length
  return `Rank ${entry.value.rank} of ${ranked} by ${METRIC_LABEL[filters.value.metric].toLowerCase()}`
})

const metricValue = computed(() => (person.value ? rankValue(person.value, filters.value.metric) : null))

function go(target: { personId: string } | null) {
  if (target) router.replace({ path: `/agents/${target.personId}`, query: query.value })
}

function onKey(event: KeyboardEvent) {
  const field = (event.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable]')
  if (field || event.altKey || event.ctrlKey || event.metaKey) return
  if (event.key === 'ArrowRight' || event.key === 'j') go(next.value)
  if (event.key === 'ArrowLeft' || event.key === 'k') go(previous.value)
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const line = computed(() => summaryLine(filters.value, quarter.value, calendarMonths.value))
</script>

<template>
  <div class="agent" data-testid="agent-cockpit">
    <InstrumentSkeleton v-if="loading && !data" />
    <CockpitEmpty v-else-if="error" kind="error" :message="error" />
    <CockpitEmpty v-else-if="!data" kind="no-upload" />
    <section v-else-if="!person" class="agent__missing">
      <h1>That person isn’t in {{ `Q${data.summary.quarter} ${data.summary.year}` }}.</h1>
      <v-btn variant="outlined" :to="{ path: '/', query }">Back to the team</v-btn>
    </section>

    <template v-else-if="reading">
      <nav class="agent__nav" aria-label="Agents">
        <v-btn variant="text" prepend-icon="mdi-arrow-left" :to="{ path: '/', query }">Team cockpit</v-btn>
        <span class="agent__step">
          <v-btn variant="outlined" size="small" :disabled="!previous" :aria-label="previous ? `Previous: ${previous.name}` : 'No previous agent'" @click="go(previous)">
            <v-icon icon="mdi-chevron-left" />
          </v-btn>
          <span class="agent__position">{{ index >= 0 ? `${index + 1} / ${standings.length}` : '—' }}</span>
          <v-btn variant="outlined" size="small" :disabled="!next" :aria-label="next ? `Next: ${next.name}` : 'No next agent'" @click="go(next)">
            <v-icon icon="mdi-chevron-right" />
          </v-btn>
          <span class="agent__hint">← → to step</span>
        </span>
      </nav>

      <CockpitHeading :title="person.name" :summary="data.summary" :calendar-months="calendarMonths" :line="line" />

      <dl class="agent__facts">
        <div><dt class="micro-label">Area</dt><dd><AreaTag :area="person.area" /></dd></div>
        <div><dt class="micro-label">Position</dt><dd>{{ ROLE_LABEL[person.position] }}</dd></div>
        <div><dt class="micro-label">Standing</dt><dd data-testid="agent-rank">{{ rankText }}</dd></div>
        <div>
          <dt class="micro-label">Projection</dt>
          <dd>
            <template v-if="person.projection.attainment !== null">
              At this run rate, finishes Q{{ quarter }} at <strong>{{ formatPercent(person.projection.attainment) }}</strong> of target
            </template>
            <template v-else>{{ person.measured ? 'No data yet' : 'No target set' }}</template>
          </dd>
        </div>
        <div v-if="metricValue !== null && filters.metric === 'combi_pct'"><dt class="micro-label">Ranked on</dt><dd>{{ formatPercent(metricValue) }}</dd></div>
      </dl>

      <CockpitCluster
        :reading="reading"
        :settings="sales.settings"
        :period-label="periodLabel"
        :by-when="byWhen"
        :quarter-label="`Q${quarter}`"
        :subject="person.name"
      />

      <section class="agent__trend">
        <TrendLines :title="`${person.firstName}'s combi attainment by month`" :labels="trends.monthLabels.value" :series="trends.personMonths(person)" />
      </section>
    </template>
  </div>
</template>

<style scoped>
.agent {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}

.agent__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.agent__step {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.agent__position {
  min-width: 56px;
  text-align: center;
  font-weight: 600;
}

.agent__hint {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-ink-2));
}

.agent__facts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, auto));
  justify-content: start;
  gap: 8px 40px;
}

.agent__facts dd {
  margin-top: 4px;
}

.agent__trend {
  max-width: 720px;
  padding-top: 24px;
  border-top: 1px solid rgb(var(--v-theme-line));
}

.agent__missing {
  display: grid;
  gap: 16px;
  justify-items: start;
}

@media (max-width: 800px) {
  .agent__facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .agent__hint {
    display: none;
  }
}

/* Wide tables scroll inside their own frame, never the page. */
.agent > * {
  min-width: 0;
}
</style>
