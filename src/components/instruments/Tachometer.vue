<script setup lang="ts">
import { computed } from 'vue'
import DialFace from './DialFace.vue'
import StatusPill from './StatusPill.vue'
import { niceMax } from '@/lib/instruments/geometry'
import { formatCount, PACE_LABEL, type PaceStatus } from '@/lib/metrics'

/**
 * Calls against target, as a tachometer: the scale runs a little past the
 * target, a printed marker sits at the target, and the red / caution segments
 * fall at 70% / 100% of it.
 */
const props = withDefaults(
  defineProps<{
    calls: number | null
    /** Calls expected by now (the target the marker shows). */
    target: number | null
    status: PaceStatus
    label?: string
  }>(),
  { label: 'Calls' },
)

const scale = computed(() => niceMax(Math.max((props.target ?? 0) * 1.25, (props.calls ?? 0) * 1.05, 10), 5))

const compact = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : String(v))

const bands = computed(() =>
  props.target ? [
    { from: 0, to: props.target * 0.7, tone: 'critical' as const },
    { from: props.target * 0.7, to: props.target, tone: 'caution' as const },
  ] : [],
)

const caption = computed(() => {
  if (props.calls === null) return 'no data yet'
  if (!props.target) return 'calls · no target set'
  return `of ${formatCount(props.target)} target`
})

const spoken = computed(() => {
  if (props.calls === null) return `${props.label}: no data yet`
  const target = props.target ? ` of ${formatCount(props.target)} target, ${PACE_LABEL[props.status].toLowerCase()}` : ', no target set'
  return `${props.label} ${formatCount(props.calls)}${target}`
})
</script>

<template>
  <figure class="gauge" data-instrument="Calls">
    <figcaption class="gauge__title micro-label">{{ label }}</figcaption>
    <DialFace
      :value="calls"
      :max="scale.max"
      :major-step="scale.step"
      :minor-step="scale.step / 4"
      :numeral-step="scale.step"
      :format-numeral="compact"
      :bands="bands"
      :marker="target"
      :readout="calls === null ? '—' : formatCount(calls)"
      :caption="caption"
      :label="spoken"
      size="small"
    />
    <div class="gauge__status">
      <StatusPill :status="status" size="sm" />
    </div>
  </figure>
</template>

<style scoped>
.gauge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin: 0;
  min-width: 0;
}

.gauge__title {
  align-self: stretch;
  text-align: center;
}

.gauge :deep(.dial) {
  max-width: 220px;
}

.gauge__status {
  min-height: 24px;
}
</style>
