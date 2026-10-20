<script setup lang="ts">
import type { TellTaleKey } from '@/lib/metrics'

/**
 * A warning lamp. Lit: the pictogram filled solid in its status colour.
 * Unlit: a dim outline. Always with a text label and a one-line reason — the
 * lamp is never colour alone, and it never blooms.
 */
defineProps<{
  kind: TellTaleKey
  label: string
  lit: boolean
  tone: 'caution' | 'critical'
  detail: string
}>()
</script>

<template>
  <div class="lamp" :class="[lit ? `is-lit is-${tone}` : 'is-off']" role="status" :data-telltale="kind" :data-lit="lit">
    <svg class="lamp__icon" viewBox="0 0 24 24" aria-hidden="true">
      <!-- Behind pace: a dial reading low. -->
      <g v-if="kind === 'behind_pace'">
        <path class="shape" d="M2.5 18a9.5 9.5 0 0 1 19 0z" />
        <path class="cut" d="M12 18 6.6 12.6" />
        <circle class="cut-dot" cx="12" cy="18" r="1.6" />
      </g>
      <!-- No in-house: the house. -->
      <g v-else-if="kind === 'no_inhouse'">
        <path class="shape" d="M3.5 11 12 3.8l8.5 7.2V20.5h-17z" />
        <path class="cut" d="M10 20.5v-5h4v5" />
      </g>
      <!-- No ethical: a capsule, for ethical (prescription) lines. -->
      <g v-else-if="kind === 'no_ethical'">
        <path class="shape" d="M14.5 3.9a4.6 4.6 0 0 1 6.5 6.5L10.4 21a4.6 4.6 0 0 1-6.5-6.5z" />
        <path class="cut" d="M9.2 9.2l5.6 5.6" />
      </g>
      <!-- Calls low: the handset. -->
      <g v-else>
        <path
          class="shape"
          d="M6.6 3.5 9.4 3l1.7 4.4-2.2 1.6a12 12 0 0 0 6.1 6.1l1.6-2.2 4.4 1.7-.5 2.8c-.2 1.1-1.2 1.9-2.3 1.8C10.9 18.6 5.4 13.1 4.8 5.8c-.1-1.1.7-2.1 1.8-2.3z"
        />
      </g>
    </svg>
    <div class="lamp__text">
      <span class="lamp__label">{{ label }}</span>
      <span class="lamp__detail">{{ detail }}</span>
      <span class="sr-only">{{ lit ? 'warning on' : 'off' }}</span>
    </div>
  </div>
</template>

<style scoped>
.lamp {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.lamp__icon {
  flex: none;
  width: 32px;
  height: 32px;
  padding: 4px;
  border: 1px solid rgb(var(--v-theme-line));
  border-radius: 4px;
  background-color: rgb(var(--v-theme-dial-face));
}

.lamp__icon .shape {
  stroke-width: 1.6;
  stroke-linejoin: round;
}

.lamp__icon .cut {
  fill: none;
  stroke-width: 1.8;
  stroke-linecap: round;
}

/* Off: a dim printed outline. */
.is-off .shape {
  fill: none;
  stroke: rgb(var(--v-theme-ink-3));
}

.is-off .cut {
  stroke: rgb(var(--v-theme-ink-3));
}

.is-off .cut-dot {
  fill: rgb(var(--v-theme-ink-3));
}

/* Lit: solid fill in the status colour; inner strokes cut back to the face. */
.is-lit .shape {
  stroke: none;
}

.is-lit.is-caution .shape {
  fill: rgb(var(--v-theme-caution));
}

.is-lit.is-critical .shape {
  fill: rgb(var(--v-theme-critical));
}

.is-lit .cut {
  stroke: rgb(var(--v-theme-dial-face));
}

.is-lit .cut-dot {
  fill: rgb(var(--v-theme-dial-face));
}

.lamp__text {
  display: grid;
  min-width: 0;
}

.lamp__label {
  font-family: var(--font-label);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  white-space: nowrap;
  text-transform: uppercase;
  color: rgb(var(--v-theme-ink-2));
}

.is-lit .lamp__label {
  color: rgb(var(--v-theme-ink));
}

.lamp__detail {
  font-size: 0.8125rem;
  line-height: 1.3;
  color: rgb(var(--v-theme-ink-2));
}

.is-lit.is-caution .lamp__detail {
  color: rgb(var(--v-theme-caution-ink));
}

.is-lit.is-critical .lamp__detail {
  color: rgb(var(--v-theme-critical-ink));
}
</style>
