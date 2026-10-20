<script setup lang="ts">
import { computed } from 'vue'
import DialFace from './DialFace.vue'
import StatusPill from './StatusPill.vue'
import { formatPercent, PACE_LABEL, type PaceStatus } from '@/lib/metrics'

/**
 * Attainment on a printed 0–120% dial. The hero speedometer (combi) and the
 * smaller in-house / ethical dials are this one instrument at two sizes.
 *
 * The caution and critical segments are printed where pace says they belong:
 * for a single month, or at the end of the quarter, that's the familiar
 * 70% / 100%; one month into a quarter it's 70% and 100% of a third, with a
 * marker at what "expected" means today. So the dial shows the true quarter
 * attainment and still tells you whether it's on schedule.
 */
const props = withDefaults(
  defineProps<{
    label: string
    ratio: number | null
    status: PaceStatus
    /** Share of the target expected by now (1 for a month or a finished quarter). */
    expectedShare?: number
    onPace?: number
    atRisk?: number
    caption?: string
    size?: 'hero' | 'small'
    /** Extra words for the accessible description, e.g. "₱240,669 of ₱32M". */
    detail?: string
    showPill?: boolean
  }>(),
  { expectedShare: 1, onPace: 1, atRisk: 0.7, caption: '', size: 'small', detail: '', showPill: true },
)

const MAX = 1.2

const bands = computed(() => [
  { from: 0, to: props.atRisk * props.expectedShare, tone: 'critical' as const },
  { from: props.atRisk * props.expectedShare, to: props.onPace * props.expectedShare, tone: 'caution' as const },
])

const marker = computed(() => (props.expectedShare < 0.999 ? props.expectedShare : null))

const readout = computed(() => (props.ratio === null ? '—' : formatPercent(props.ratio).replace('%', '')))
const unit = computed(() => (props.ratio === null ? '' : '%'))

const caption = computed(() => {
  if (props.status === 'no_data') return 'no data yet'
  if (props.status === 'no_target') return 'no target set'
  return props.caption || props.label
})

const spoken = computed(() => {
  const value = props.ratio === null ? (props.status === 'no_data' ? 'no data yet' : 'no target set') : formatPercent(props.ratio)
  const pace = props.ratio === null ? '' : `, ${PACE_LABEL[props.status].toLowerCase()}`
  const expected = marker.value ? `; ${formatPercent(marker.value)} expected by now` : ''
  return `${props.label} ${value}${pace}${expected}${props.detail ? `. ${props.detail}` : ''}`
})

const pillDetail = computed(() =>
  marker.value && props.ratio !== null ? `${formatPercent(props.ratio / props.expectedShare)} of expected` : '',
)
</script>

<template>
  <figure class="gauge" :class="`gauge--${size}`" :data-instrument="label">
    <figcaption class="gauge__title micro-label">{{ label }}</figcaption>
    <DialFace
      :value="ratio"
      :max="MAX"
      :major-step="0.2"
      :minor-step="size === 'hero' ? 0.05 : 0.1"
      :numeral-step="size === 'hero' ? 0.2 : 0.4"
      :format-numeral="(v) => String(Math.round(v * 100))"
      :bands="bands"
      :marker="marker"
      :readout="readout"
      :unit="unit"
      :caption="caption"
      :label="spoken"
      :size="size"
    />
    <div v-if="showPill" class="gauge__status">
      <StatusPill :status="status" :detail="pillDetail" :size="size === 'hero' ? 'md' : 'sm'" />
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

.gauge--hero {
  gap: 12px;
}

.gauge__title {
  align-self: stretch;
  text-align: center;
}

.gauge--hero :deep(.dial) {
  max-width: 420px;
}

.gauge--small :deep(.dial) {
  max-width: 220px;
}

.gauge__status {
  min-height: 24px;
}
</style>
