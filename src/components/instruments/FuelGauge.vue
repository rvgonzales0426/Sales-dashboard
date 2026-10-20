<script setup lang="ts">
import { computed } from 'vue'
import { formatPercent, formatPeso, PACE_TONE, type PaceStatus } from '@/lib/metrics'

/**
 * Quarter quota as a fuel gauge: twenty flat cells from E to F, filled in the
 * pace's status colour (one of the three places status colour may appear),
 * with the reading in words beside it.
 */
const props = defineProps<{
  /** Actual so far ÷ the FULL quarter target (not expected-to-date). */
  progress: number | null
  status: PaceStatus
  actual: number | null
  target: number | null
  periodLabel: string
}>()

const CELLS = 20
const filled = computed(() => (props.progress === null ? 0 : Math.min(CELLS, Math.floor(Math.max(props.progress, 0) * CELLS + 1e-9))))
const tone = computed(() => PACE_TONE[props.status])
const over = computed(() => props.progress !== null && props.progress > 1)

const spoken = computed(() =>
  props.progress === null
    ? `${props.periodLabel} quota: no target set`
    : `${props.periodLabel} quota ${formatPercent(props.progress)} used: ${formatPeso(props.actual)} of ${formatPeso(props.target)}`,
)
</script>

<template>
  <figure class="fuel" role="img" :aria-label="spoken" data-instrument="Quota">
    <figcaption class="micro-label">Quota · {{ periodLabel }}</figcaption>
    <div class="fuel__gauge" aria-hidden="true">
      <span class="fuel__end">E</span>
      <div class="fuel__cells" :class="`is-${tone}`">
        <span v-for="i in CELLS" :key="i" class="fuel__cell" :class="{ 'is-on': i <= filled }" />
      </div>
      <span class="fuel__end">F</span>
    </div>
    <div class="fuel__reading" aria-hidden="true">
      <span class="fuel__pct">{{ formatPercent(progress) }}</span>
      <span v-if="over" class="fuel__over">over quota</span>
      <span class="fuel__of">{{ progress === null ? 'no target set' : `${formatPeso(actual, { whole: true })} of ${formatPeso(target, { whole: true })}` }}</span>
    </div>
  </figure>
</template>

<style scoped>
.fuel {
  margin: 0;
  display: grid;
  gap: 8px;
  min-width: 0;
}

.fuel__gauge {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fuel__end {
  font-family: var(--font-label);
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(var(--v-theme-ink-2));
}

.fuel__cells {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(20, minmax(0, 1fr));
  gap: 2px;
  height: 16px;
  padding: 2px;
  border: 1px solid rgb(var(--v-theme-line-strong));
  border-radius: 2px;
}

.fuel__cell {
  background-color: rgb(var(--v-theme-track));
}

/* The ½ mark, printed under the middle like on a fuel gauge. */
.fuel__cells {
  position: relative;
}

.fuel__cells::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -6px;
  width: 1px;
  height: 4px;
  background-color: rgb(var(--v-theme-ink-3));
}

.is-good .fuel__cell.is-on {
  background-color: rgb(var(--v-theme-good));
}

.is-caution .fuel__cell.is-on {
  background-color: rgb(var(--v-theme-caution));
}

.is-critical .fuel__cell.is-on {
  background-color: rgb(var(--v-theme-critical));
}

.is-neutral .fuel__cell.is-on {
  background-color: rgb(var(--v-theme-ink-2));
}

.fuel__reading {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 10px;
}

.fuel__pct {
  font-size: 1.375rem;
  font-weight: 600;
  line-height: 1;
}

.fuel__over {
  font-family: var(--font-label);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-good-ink));
}

.fuel__of {
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-ink-2));
}
</style>
