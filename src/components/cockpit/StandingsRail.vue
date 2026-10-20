<script setup lang="ts">
import { computed } from 'vue'
import StatusPill from '@/components/instruments/StatusPill.vue'
import AreaTag from './AreaTag.vue'
import { formatCount, formatPercent, formatPeso, formatPesoCompact, type PersonMetrics, type Ranked, type RankMetric } from '@/lib/metrics'

/**
 * Standings: everyone in view, ranked on the chosen metric, with an inline bar
 * on one shared scale. The top (or bottom) N carry a filled rank badge. Each
 * row opens that person's cockpit, keeping the filters.
 */
const props = defineProps<{
  standings: Ranked<PersonMetrics>[]
  highlighted: Set<string>
  metric: RankMetric
  query: Record<string, string>
  title: string
}>()

const ranked = computed(() => props.standings.filter((r) => r.rank !== null))
const unranked = computed(() => props.standings.filter((r) => r.rank === null))

const scaleMax = computed(() => Math.max(...ranked.value.map((r) => Math.abs(r.value ?? 0)), 1e-9))

const format = (value: number | null) => {
  if (value === null) return '—'
  if (props.metric === 'combi_pct') return formatPercent(value)
  if (props.metric === 'calls') return formatCount(value)
  return formatPesoCompact(value)
}

const full = (value: number | null) => {
  if (value === null) return 'not ranked'
  if (props.metric === 'combi_pct') return formatPercent(value, 1)
  if (props.metric === 'calls') return `${formatCount(value)} calls`
  return formatPeso(value)
}

const width = (value: number | null) => `${Math.max(0, ((value ?? 0) / scaleMax.value) * 100)}%`
</script>

<template>
  <section class="rail" :aria-label="title" data-testid="standings">
    <header class="rail__head">
      <h2 class="micro-label">{{ title }}</h2>
    </header>

    <ol class="rail__list">
      <li v-for="row in ranked" :key="row.item.personId" :class="{ 'is-top': highlighted.has(row.item.personId) }">
        <router-link
          class="rail__row"
          :to="{ path: `/agents/${row.item.personId}`, query }"
          :aria-label="`Rank ${row.rank}: ${row.item.name}, ${full(row.value)}. Open their cockpit.`"
          :data-person="row.item.lastName"
          :data-rank="row.rank"
        >
          <span class="rail__rank" :class="{ 'is-badge': highlighted.has(row.item.personId) }">{{ row.rank }}</span>
          <span class="rail__who">
            <span class="rail__name">{{ row.item.name }}</span>
            <span class="rail__meta">
              <AreaTag :area="row.item.area" />
              <StatusPill :status="row.item.pace.status" size="sm" />
            </span>
          </span>
          <span class="rail__value" :title="full(row.value)">{{ format(row.value) }}</span>
          <span class="rail__bar" aria-hidden="true">
            <span class="rail__fill" :style="{ width: width(row.value) }" />
          </span>
        </router-link>
      </li>
    </ol>

    <template v-if="unranked.length">
      <h3 class="rail__sub micro-label">Not ranked · no target set</h3>
      <ul class="rail__list rail__list--quiet">
        <li v-for="row in unranked" :key="row.item.personId">
          <router-link class="rail__row" :to="{ path: `/agents/${row.item.personId}`, query }" :data-person="row.item.lastName">
            <span class="rail__rank">—</span>
            <span class="rail__who">
              <span class="rail__name">{{ row.item.name }}</span>
              <span class="rail__meta"><AreaTag :area="row.item.area" /></span>
            </span>
            <span class="rail__value">{{ formatPesoCompact(row.item.actual.combi) }}</span>
          </router-link>
        </li>
      </ul>
    </template>

    <p v-if="!standings.length" class="rail__empty">No one matches these filters.</p>
  </section>
</template>

<style scoped>
.rail {
  min-width: 0;
}

.rail__head {
  padding-bottom: 8px;
  border-bottom: 1px solid rgb(var(--v-theme-line));
}

.rail__list {
  list-style: none;
}

.rail__row {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  grid-template-areas:
    'rank who value'
    'rank bar bar';
  align-items: center;
  gap: 4px 12px;
  padding: 10px 4px;
  border-bottom: 1px solid rgb(var(--v-theme-line));
  color: inherit;
  text-decoration: none;
}

.rail__row:hover {
  background-color: rgb(var(--v-theme-surface-alt));
}

.rail__rank {
  grid-area: rank;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  font-weight: 600;
  color: rgb(var(--v-theme-ink-2));
}

/* Top N: a solid ink badge — visible without colour. */
.rail__rank.is-badge {
  border-radius: 3px;
  background-color: rgb(var(--v-theme-ink));
  color: rgb(var(--v-theme-surface));
}

.rail__who {
  grid-area: who;
  display: grid;
  gap: 4px;
  min-width: 0;
}

.rail__name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.is-top .rail__name {
  font-weight: 600;
}

.rail__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.rail__value {
  grid-area: value;
  font-weight: 600;
  text-align: right;
}

.rail__bar {
  grid-area: bar;
  height: 4px;
  background-color: rgb(var(--v-theme-track));
}

.rail__fill {
  display: block;
  height: 100%;
  background-color: rgb(var(--v-theme-ink-3));
}

.is-top .rail__fill {
  background-color: rgb(var(--v-theme-ink));
}

.rail__sub {
  display: block;
  margin-top: 16px;
  padding-bottom: 4px;
}

.rail__list--quiet .rail__row {
  grid-template-areas: 'rank who value';
  color: rgb(var(--v-theme-ink-2));
}

.rail__empty {
  padding: 16px 4px;
  color: rgb(var(--v-theme-ink-2));
}
</style>
