<script setup lang="ts">
import { computed } from 'vue'
import { formatPeso, formatPesoCompact } from '@/lib/metrics'

/**
 * Range to target: the carried-forward catch-up amount, as a car shows the
 * distance left in the tank. Zero means ahead — never a negative number.
 */
const props = defineProps<{
  catchUp: number | null
  /** "end of October", "today" … */
  byWhen: string
  projection: number | null
}>()

const ahead = computed(() => props.catchUp === 0)

const spoken = computed(() => {
  if (props.catchUp === null) return 'Range to target: no target set'
  if (ahead.value) return `Range to target: ahead, nothing to catch up by ${props.byWhen}`
  return `Range to target: ${formatPeso(props.catchUp)} to catch up by ${props.byWhen}`
})
</script>

<template>
  <figure class="range" role="img" :aria-label="spoken" data-instrument="Range">
    <figcaption class="micro-label">Range to target</figcaption>
    <div class="range__row" aria-hidden="true">
      <svg class="range__glyph" viewBox="0 0 24 24">
        <!-- A flag on a pole: the finish, how far off it is. -->
        <path d="M6 21V4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        <path d="M6 4h11l-2.5 4L17 12H6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
      </svg>
      <span v-if="catchUp === null" class="range__value range__value--muted">—</span>
      <span v-else-if="ahead" class="range__value">Ahead</span>
      <span v-else class="range__value" :title="formatPeso(catchUp)">{{ formatPesoCompact(catchUp) }}</span>
    </div>
    <p class="range__caption" aria-hidden="true">
      <template v-if="catchUp === null">no target set</template>
      <template v-else-if="ahead">nothing to catch up by {{ byWhen }}</template>
      <template v-else>{{ formatPeso(catchUp) }} to catch up by {{ byWhen }}</template>
    </p>
    <p v-if="projection !== null" class="range__caption" aria-hidden="true">
      Run rate finishes the quarter at <strong>{{ Math.round(projection * 100) }}%</strong> of target
    </p>
  </figure>
</template>

<style scoped>
.range {
  margin: 0;
  display: grid;
  gap: 6px;
  min-width: 0;
}

.range__row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.range__glyph {
  width: 22px;
  height: 22px;
  color: rgb(var(--v-theme-ink-2));
  flex: none;
}

.range__value {
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1;
}

.range__value--muted {
  color: rgb(var(--v-theme-ink-2));
}

.range__caption {
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-ink-2));
}

.range__caption strong {
  color: rgb(var(--v-theme-ink));
  font-weight: 600;
}
</style>
