<script setup lang="ts">
import { computed } from 'vue'
import { useTween } from '@/composables/useTween'
import { formatPeso } from '@/lib/metrics'

/**
 * Quarter-to-date collected, on mechanical-style digit cells: fixed width,
 * tabular figures, the centavo wheels set apart like an odometer's tenths.
 * Always the full value — this is where ₱12.4M is spelled out in full.
 */
const props = withDefaults(defineProps<{ centavos: number | null; label?: string; caption?: string }>(), {
  label: 'Collected',
  caption: '',
})

const shown = useTween(() => props.centavos, 600)

/** "₱245,649.86" → peso cells, comma separators, centavo cells. */
const parts = computed(() => {
  if (shown.value === null) return null
  const text = formatPeso(Math.round(shown.value))
  const negative = text.startsWith('-')
  const [whole, cents] = text.replace(/^-?₱/, '').split('.')
  return { negative, whole: whole.split(''), cents: (cents ?? '00').split('') }
})

const spoken = computed(() => `${props.label}: ${props.centavos === null ? 'no data yet' : formatPeso(props.centavos)}`)
</script>

<template>
  <figure class="odo" role="img" :aria-label="spoken" data-instrument="Odometer">
    <figcaption class="micro-label">{{ label }}</figcaption>
    <div v-if="parts" class="odo__window" aria-hidden="true" data-testid="odometer-value">
      <span class="odo__sign">{{ parts.negative ? '−₱' : '₱' }}</span>
      <template v-for="(ch, i) in parts.whole" :key="`w${i}`">
        <span v-if="ch === ','" class="odo__sep">,</span>
        <span v-else class="odo__cell">{{ ch }}</span>
      </template>
      <span class="odo__sep">.</span>
      <span v-for="(ch, i) in parts.cents" :key="`c${i}`" class="odo__cell odo__cell--cents">{{ ch }}</span>
    </div>
    <div v-else class="odo__window odo__window--empty" aria-hidden="true">no data yet</div>
    <p v-if="caption" class="odo__caption">{{ caption }}</p>
  </figure>
</template>

<style scoped>
.odo {
  margin: 0;
  display: grid;
  gap: 8px;
  min-width: 0;
}

.odo__window {
  display: inline-flex;
  align-items: stretch;
  justify-self: start;
  max-width: 100%;
  padding: 3px;
  gap: 2px;
  border: 1px solid rgb(var(--v-theme-line-strong));
  border-radius: 3px;
  background-color: rgb(var(--v-theme-dial-face));
  font-variant-numeric: tabular-nums;
  overflow: hidden;
}

.odo__window--empty {
  padding: 8px 12px;
  font-size: 0.875rem;
  color: rgb(var(--v-theme-ink-2));
}

.odo__sign,
.odo__sep {
  display: inline-flex;
  align-items: center;
  padding: 0 2px;
  font-size: 1.125rem;
  font-weight: 500;
  color: rgb(var(--v-theme-ink-2));
}

.odo__cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.15em;
  height: 1.6em;
  font-size: 1.375rem;
  font-weight: 600;
  line-height: 1;
  color: rgb(var(--v-theme-ink));
  background-color: rgb(var(--v-theme-surface));
  border-top: 1px solid rgb(var(--v-theme-line));
  border-bottom: 1px solid rgb(var(--v-theme-line));
}

/* Centavo wheels: the same cell, inverted, like an odometer's tenths. */
.odo__cell--cents {
  font-size: 1.125rem;
  width: 1.2em;
  background-color: rgb(var(--v-theme-ink));
  color: rgb(var(--v-theme-surface));
}

.odo__caption {
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-ink-2));
}

@media (max-width: 420px) {
  .odo__cell {
    font-size: 1.125rem;
  }

  .odo__cell--cents {
    font-size: 0.9375rem;
  }
}
</style>
