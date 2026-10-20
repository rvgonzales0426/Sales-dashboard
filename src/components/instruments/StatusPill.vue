<script setup lang="ts">
import { computed } from 'vue'
import { PACE_LABEL, PACE_TONE, type PaceStatus } from '@/lib/metrics'

/** Pace as a pill: a shape-coded icon AND a word. Colour is the third signal, never the only one. */
const props = withDefaults(defineProps<{ status: PaceStatus; detail?: string; size?: 'sm' | 'md' }>(), {
  detail: '',
  size: 'md',
})

const ICON: Record<PaceStatus, string> = {
  ahead: 'mdi-chevron-double-up',
  on_pace: 'mdi-check',
  at_risk: 'mdi-alert-outline',
  behind: 'mdi-chevron-double-down',
  no_target: 'mdi-minus',
  no_data: 'mdi-clock-outline',
}

const tone = computed(() => PACE_TONE[props.status])
</script>

<template>
  <span class="pill" :class="[`is-${tone}`, `pill--${size}`]" :data-status="status">
    <v-icon :icon="ICON[status]" :size="size === 'sm' ? 13 : 15" class="pill__icon" aria-hidden="true" />
    <span class="pill__label">{{ PACE_LABEL[status] }}</span>
    <span v-if="detail" class="pill__detail">{{ detail }}</span>
  </span>
</template>

<style scoped>
.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px 3px 7px;
  border: 1px solid currentColor;
  border-radius: 3px;
  font-family: var(--font-label);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}

.pill--sm {
  padding: 1px 7px 1px 5px;
  font-size: 0.6875rem;
  gap: 4px;
}

.pill.is-good {
  color: rgb(var(--v-theme-good-ink));
}

.pill.is-caution {
  color: rgb(var(--v-theme-caution-ink));
}

.pill.is-critical {
  color: rgb(var(--v-theme-critical-ink));
}

.pill.is-neutral {
  color: rgb(var(--v-theme-ink-2));
  border-style: dashed;
}

.pill__detail {
  color: rgb(var(--v-theme-ink-2));
  font-weight: 500;
  letter-spacing: 0.04em;
}
</style>
