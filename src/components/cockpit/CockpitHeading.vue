<script setup lang="ts">
import { computed } from 'vue'
import type { PeriodSummary } from '@/stores/sales'
import { formatDateTime } from '@/lib/format'
import { monthName } from '@/lib/cockpit/filters'
import { elapsedMonths } from '@/lib/metrics'

/** Title, where the numbers come from, and the one-line filter summary. */
const props = defineProps<{
  title: string
  summary: PeriodSummary | null
  calendarMonths: number[] | null
  line: string
}>()

const through = computed(() => {
  if (!props.summary) return ''
  const last = elapsedMonths(props.summary.monthsWithData)
  return last ? `data through ${monthName(props.calendarMonths, last as 1 | 2 | 3)}` : 'no month has data yet'
})
</script>

<template>
  <header class="heading">
    <div class="heading__main">
      <h1 class="heading__title">{{ title }}</h1>
      <p v-if="summary" class="heading__source">
        Q{{ summary.quarter }} {{ summary.year }} · version {{ summary.version }} · uploaded {{ formatDateTime(summary.uploadedAt) }} · {{ through }}
      </p>
    </div>
    <p class="heading__line" data-testid="filter-summary" aria-live="polite">{{ line }}</p>
    <div v-if="$slots.actions" class="heading__actions"><slot name="actions" /></div>
  </header>
</template>

<style scoped>
.heading {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 24px;
  margin-bottom: 16px;
}

.heading__title {
  font-size: 1.625rem;
  font-weight: 600;
  line-height: 1.15;
}

.heading__source {
  margin-top: 4px;
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-ink-2));
}

.heading__line {
  grid-column: 1 / -1;
  font-family: var(--font-label);
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: rgb(var(--v-theme-ink));
}

.heading__actions {
  grid-row: 1;
  grid-column: 2;
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

@media (max-width: 640px) {
  .heading {
    grid-template-columns: minmax(0, 1fr);
  }

  .heading__actions {
    grid-row: auto;
    grid-column: 1;
  }
}
</style>
