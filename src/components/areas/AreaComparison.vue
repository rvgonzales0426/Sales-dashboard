<script setup lang="ts">
import { computed } from 'vue'
import AreaTag from '@/components/cockpit/AreaTag.vue'
import StatusPill from '@/components/instruments/StatusPill.vue'
import { formatCount, formatPercent, formatPeso, formatPesoCompact, rankPeople, teamMetrics, type PersonMetrics } from '@/lib/metrics'
import { AREAS } from '@/lib/cockpit/filters'
import { normalizeNamePart } from '@/lib/excel/names'
import type { CockpitFilters } from '@/lib/cockpit/filters'
import type { MetricContext } from '@/lib/metrics'
import type { Area } from '@/types'

/**
 * North vs South vs Caraga as small multiples. Every bar on every panel uses
 * the same scale, so lengths compare across areas; there is one axis per
 * measure and never a second one. Area colour marks identity only and always
 * sits beside the area's name.
 */
const props = defineProps<{
  everyone: PersonMetrics[]
  filters: CockpitFilters
  context: MetricContext
  expectedShare: number
  query: Record<string, string>
}>()

const inRole = computed(() => {
  const search = normalizeNamePart(props.filters.q)
  return props.everyone.filter(
    (p) => props.filters.roles.includes(p.position) && (!search || normalizeNamePart(`${p.firstName} ${p.lastName}`).includes(search)),
  )
})

const areas = computed<Area[]>(() => (props.filters.areas.length ? props.filters.areas : AREAS))

const panels = computed(() =>
  areas.value.map((area) => {
    const people = inRole.value.filter((p) => p.area === area)
    const team = teamMetrics(people, props.context)
    const top = rankPeople(people, 'combi').find((r) => r.rank === 1) ?? null
    return { area, people, team, top }
  }),
)

/** Shared scales: one for money collected, one for attainment. */
const moneyMax = computed(() => Math.max(...panels.value.map((p) => p.team.totals.combi), 1))
const ratioMax = computed(() =>
  Math.max(
    1,
    ...panels.value.flatMap((p) => [p.team.attainment.combi, p.team.attainment.inhouse, p.team.attainment.ethical, p.team.attainment.calls].map((v) => v ?? 0)),
  ),
)
const pct = (value: number | null, max: number) => `${Math.max(0, Math.min(1, (value ?? 0) / max)) * 100}%`
const expectedAt = computed(() => pct(props.expectedShare, ratioMax.value))

const rows = [
  { key: 'combi', label: 'Combi' },
  { key: 'inhouse', label: 'In-house' },
  { key: 'ethical', label: 'Ethical' },
  { key: 'calls', label: 'Calls' },
] as const
</script>

<template>
  <div class="areas" data-testid="area-comparison">
    <section v-for="panel in panels" :key="panel.area" class="panel" :class="`is-${panel.area}`" :data-area="panel.area">
      <header class="panel__head">
        <AreaTag :area="panel.area" class="panel__tag" />
        <span class="panel__count">{{ panel.team.headcount }} {{ panel.team.headcount === 1 ? 'person' : 'people' }}</span>
      </header>

      <div class="panel__total">
        <span class="micro-label">Collected</span>
        <strong :title="formatPeso(panel.team.totals.combi)">{{ formatPesoCompact(panel.team.totals.combi) }}</strong>
        <span class="panel__bar"><span class="panel__fill" :style="{ width: pct(panel.team.totals.combi, moneyMax) }" /></span>
      </div>

      <div class="panel__rows" role="table" :aria-label="`Attainment in ${panel.area}`">
        <div v-for="row in rows" :key="row.key" class="panel__row" role="row">
          <span class="panel__label" role="rowheader">{{ row.label }}</span>
          <span class="panel__bar panel__bar--ratio" role="cell">
            <span class="panel__fill" :style="{ width: pct(panel.team.attainment[row.key], ratioMax) }" />
            <span v-if="expectedShare < 1" class="panel__expected" :style="{ left: expectedAt }" title="Expected by now" />
            <span class="panel__target" :style="{ left: pct(1, ratioMax) }" title="Target" />
          </span>
          <span class="panel__value" role="cell">{{ formatPercent(panel.team.attainment[row.key]) }}</span>
        </div>
      </div>

      <dl class="panel__facts">
        <div><dt class="micro-label">Pace</dt><dd><StatusPill :status="panel.team.pace.status" size="sm" /></dd></div>
        <div>
          <dt class="micro-label">Calls</dt>
          <dd>{{ formatCount(panel.team.measuredActual.calls) }} <span class="muted">of {{ formatCount(panel.team.callsPace.expected) }}</span></dd>
        </div>
        <div class="panel__top">
          <dt class="micro-label">Top performer</dt>
          <dd v-if="panel.top">
            <router-link :to="{ path: `/agents/${panel.top.item.personId}`, query }">{{ panel.top.item.name }}</router-link>
            <span class="muted"> · {{ formatPesoCompact(panel.top.item.actual.combi) }}</span>
          </dd>
          <dd v-else class="muted">No one ranked yet</dd>
        </div>
      </dl>
    </section>

    <p class="areas__key">
      Bars share one scale across areas. <span class="areas__key-target" /> target <template v-if="expectedShare < 1"><span class="areas__key-expected" /> expected by now</template>
    </p>
  </div>
</template>

<style scoped>
.areas {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.panel {
  display: grid;
  gap: 16px;
  align-content: start;
  padding: 20px;
  border: 1px solid rgb(var(--v-theme-line));
  border-top: 3px solid rgb(var(--v-theme-ink-3));
  border-radius: 6px;
  background-color: rgb(var(--v-theme-surface));
  min-width: 0;
}

.panel.is-north {
  border-top-color: rgb(var(--v-theme-area-north));
}

.panel.is-south {
  border-top-color: rgb(var(--v-theme-area-south));
}

.panel.is-caraga {
  border-top-color: rgb(var(--v-theme-area-caraga));
}

.panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel__tag {
  font-size: 0.875rem;
}

.panel__count,
.muted {
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-ink-2));
}

.panel__total {
  display: grid;
  gap: 4px;
}

.panel__total strong {
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.1;
}

.panel__bar {
  position: relative;
  display: block;
  height: 8px;
  background-color: rgb(var(--v-theme-track));
}

.panel__fill {
  display: block;
  height: 100%;
  background-color: rgb(var(--v-theme-ink-2));
}

.is-north .panel__fill {
  background-color: rgb(var(--v-theme-area-north));
}

.is-south .panel__fill {
  background-color: rgb(var(--v-theme-area-south));
}

.is-caraga .panel__fill {
  background-color: rgb(var(--v-theme-area-caraga));
}

.panel__rows {
  display: grid;
  gap: 10px;
}

.panel__row {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) 48px;
  align-items: center;
  gap: 10px;
  font-size: 0.875rem;
}

.panel__label {
  color: rgb(var(--v-theme-ink-2));
}

.panel__value {
  text-align: right;
  font-weight: 600;
}

.panel__target,
.panel__expected {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 2px;
  margin-left: -1px;
  background-color: rgb(var(--v-theme-ink));
}

.panel__expected {
  width: 0;
  border-left: 2px dotted rgb(var(--v-theme-ink));
  background: none;
}

.panel__facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid rgb(var(--v-theme-line));
}

.panel__facts dd {
  margin-top: 4px;
}

.panel__top {
  grid-column: 1 / -1;
}

.panel__top a {
  color: rgb(var(--v-theme-ink));
  font-weight: 600;
}

.areas__key {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-ink-2));
}

.areas__key-target,
.areas__key-expected {
  display: inline-block;
  width: 2px;
  height: 12px;
  margin-left: 8px;
  background-color: rgb(var(--v-theme-ink));
}

.areas__key-expected {
  width: 0;
  background: none;
  border-left: 2px dotted rgb(var(--v-theme-ink));
}

@media (max-width: 1100px) {
  .areas {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
