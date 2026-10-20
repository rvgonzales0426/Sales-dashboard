<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatPercent } from '@/lib/metrics'
import type { TrendSeries } from '@/lib/cockpit/trend'

/**
 * Attainment over time — months within a quarter, or quarters over time — so
 * the cockpit shows direction, not just a snapshot. One y axis (attainment %),
 * a printed 100% target line, 2px lines with ≥ 8px markers. A point without
 * data is a gap labelled "no data yet", never a zero.
 *
 * Measured in real pixels (like the template's area chart) so strokes and
 * text stay crisp at any width.
 */
const props = withDefaults(
  defineProps<{
    title: string
    labels: string[]
    series: TrendSeries[]
    height?: number
  }>(),
  { height: 220 },
)

const container = ref<HTMLElement | null>(null)
const width = ref(560)
let observer: ResizeObserver | null = null

onMounted(() => {
  if (!container.value) return
  observer = new ResizeObserver(([entry]) => (width.value = Math.max(260, entry.contentRect.width)))
  observer.observe(container.value)
  width.value = Math.max(260, container.value.clientWidth)
})
onBeforeUnmount(() => observer?.disconnect())

const PAD = { top: 16, right: 64, bottom: 30, left: 44 }
const innerW = computed(() => width.value - PAD.left - PAD.right)
const innerH = computed(() => props.height - PAD.top - PAD.bottom)

const yMax = computed(() => {
  const values = props.series.flatMap((s) => s.values.filter((v): v is number => v !== null))
  const top = Math.max(1.2, ...values.map((v) => v * 1.1))
  return Math.ceil(top / 0.2) * 0.2
})

const x = (i: number) => PAD.left + (props.labels.length <= 1 ? innerW.value / 2 : (i / (props.labels.length - 1)) * innerW.value)
const y = (v: number) => PAD.top + innerH.value - (Math.max(v, 0) / yMax.value) * innerH.value

const gridLines = computed(() => {
  const step = yMax.value > 2 ? 0.5 : 0.2
  const lines: number[] = []
  for (let v = 0; v <= yMax.value + 1e-9; v += step) lines.push(Math.round(v * 100) / 100)
  return lines
})

/** Split each series at gaps so a missing month is a break, not a dip to zero. */
const paths = computed(() =>
  props.series.map((s) => {
    const segments: string[] = []
    let current = ''
    s.values.forEach((v, i) => {
      if (v === null) {
        if (current) segments.push(current)
        current = ''
        return
      }
      current += `${current ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `
    })
    if (current) segments.push(current)
    const lastIndex = s.values.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0).pop()
    return { ...s, d: segments.join(' '), lastIndex: lastIndex ?? null }
  }),
)

/** Direct labels at each line's last point, nudged apart so none overlap (≥ 13px). */
const directLabels = computed(() => {
  if (props.series.length > 4) return []
  const labels = paths.value
    .filter((s) => s.lastIndex !== null)
    .map((s) => ({
      key: s.key,
      x: x(s.lastIndex!) + 8,
      y: y(s.values[s.lastIndex!]!) + 4,
      text: props.series.length > 1 ? s.label : formatPercent(s.values[s.lastIndex!]),
    }))
    .sort((a, b) => a.y - b.y)
  for (let i = 1; i < labels.length; i++) {
    if (labels[i].x === labels[i - 1].x && labels[i].y - labels[i - 1].y < 13) labels[i].y = labels[i - 1].y + 13
  }
  // If pushed below the plot, shift the stack up instead.
  const overflow = labels.length ? labels[labels.length - 1].y - (PAD.top + innerH.value + 4) : 0
  if (overflow > 0) labels.forEach((l) => (l.y -= overflow))
  return labels
})

const emptyColumns = computed(() => props.labels.map((_, i) => props.series.every((s) => s.values[i] === null)))

const hover = ref<number | null>(null)
function onMove(event: PointerEvent) {
  const box = (event.currentTarget as SVGElement).getBoundingClientRect()
  const px = event.clientX - box.left
  let best = 0
  props.labels.forEach((_, i) => {
    if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i
  })
  hover.value = best
}

const spoken = computed(() =>
  `${props.title}. ` +
  props.series
    .map((s) => `${s.label}: ${s.values.map((v, i) => `${props.labels[i]} ${v === null ? 'no data yet' : formatPercent(v)}`).join(', ')}`)
    .join('. '),
)
</script>

<template>
  <figure ref="container" class="trend">
    <figcaption class="micro-label trend__title">{{ title }}</figcaption>

    <ul v-if="series.length > 1" class="trend__legend">
      <li v-for="s in series" :key="s.key"><span class="trend__key" :style="{ backgroundColor: `rgb(var(--v-theme-${s.color}))` }" />{{ s.label }}</li>
    </ul>

    <svg :width="width" :height="height" role="img" :aria-label="spoken" @pointermove="onMove" @pointerleave="hover = null">
      <g class="trend__grid">
        <line v-for="v in gridLines" :key="v" :x1="PAD.left" :x2="width - PAD.right" :y1="y(v)" :y2="y(v)" />
        <text v-for="v in gridLines" :key="`t${v}`" :x="PAD.left - 8" :y="y(v) + 4" text-anchor="end">{{ Math.round(v * 100) }}%</text>
      </g>

      <!-- The target, printed once: 100% of plan. -->
      <line class="trend__target" :x1="PAD.left" :x2="width - PAD.right" :y1="y(1)" :y2="y(1)" />
      <text class="trend__target-label" :x="width - PAD.right + 6" :y="y(1) + 4">target</text>

      <g v-for="(empty, i) in emptyColumns" :key="`x${i}`">
        <text class="trend__x" :x="x(i)" :y="height - 8" text-anchor="middle">{{ labels[i] }}</text>
        <text v-if="empty" class="trend__gap" :x="x(i)" :y="PAD.top + innerH / 2" text-anchor="middle">no data yet</text>
      </g>

      <g v-for="s in paths" :key="s.key">
        <path :d="s.d" class="trend__line" :style="{ stroke: `rgb(var(--v-theme-${s.color}))` }" />
        <template v-for="(v, i) in s.values" :key="`${s.key}${i}`">
          <circle v-if="v !== null" :cx="x(i)" :cy="y(v)" r="4" class="trend__dot" :style="{ fill: `rgb(var(--v-theme-${s.color}))` }" />
        </template>
      </g>

      <!-- Direct labels at each line's last point (≤ 4 series), never overlapping. -->
      <text v-for="l in directLabels" :key="`d${l.key}`" class="trend__direct" :x="l.x" :y="l.y">{{ l.text }}</text>

      <line v-if="hover !== null" class="trend__cross" :x1="x(hover)" :x2="x(hover)" :y1="PAD.top" :y2="PAD.top + innerH" />
    </svg>

    <div v-if="hover !== null" class="trend__tip" :style="{ left: `${x(hover)}px` }" role="status">
      <strong>{{ labels[hover] }}</strong>
      <span v-for="s in series" :key="s.key">
        <span class="trend__key" :style="{ backgroundColor: `rgb(var(--v-theme-${s.color}))` }" />
        {{ s.label }} {{ s.values[hover] === null ? 'no data yet' : formatPercent(s.values[hover]) }}
      </span>
    </div>

    <table class="sr-only">
      <caption>{{ title }}</caption>
      <thead><tr><th scope="col">Series</th><th v-for="l in labels" :key="l" scope="col">{{ l }}</th></tr></thead>
      <tbody>
        <tr v-for="s in series" :key="s.key">
          <th scope="row">{{ s.label }}</th>
          <td v-for="(v, i) in s.values" :key="i">{{ v === null ? 'no data yet' : formatPercent(v) }}</td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>

<style scoped>
.trend {
  position: relative;
  margin: 0;
  min-width: 0;
}

.trend svg {
  display: block;
  touch-action: none;
}

.trend__title {
  display: block;
  margin-bottom: 8px;
}

.trend__legend {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-bottom: 4px;
  font-size: 0.8125rem;
}

.trend__legend li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.trend__key {
  display: inline-block;
  width: 10px;
  height: 3px;
  border-radius: 1px;
}

.trend__grid line {
  stroke: rgb(var(--v-theme-line));
  stroke-width: 1;
  shape-rendering: crispEdges;
}

.trend__grid text,
.trend__x,
.trend__target-label {
  fill: rgb(var(--v-theme-ink-2));
  font-size: 11px;
}

.trend__target {
  stroke: rgb(var(--v-theme-ink-2));
  stroke-width: 1;
  stroke-dasharray: 4 3;
}

.trend__gap {
  fill: rgb(var(--v-theme-ink-2));
  font-family: var(--font-label);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.trend__line {
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.trend__dot {
  stroke: rgb(var(--v-theme-surface));
  stroke-width: 2;
}

.trend__direct {
  fill: rgb(var(--v-theme-ink));
  font-size: 12px;
  font-weight: 600;
}

.trend__cross {
  stroke: rgb(var(--v-theme-line-strong));
  stroke-width: 1;
}

.trend__tip {
  position: absolute;
  top: 40px;
  transform: translateX(-50%);
  display: grid;
  gap: 2px;
  padding: 8px 10px;
  border: 1px solid rgb(var(--v-theme-line-strong));
  border-radius: 4px;
  background-color: rgb(var(--v-theme-surface));
  font-size: 0.8125rem;
  white-space: nowrap;
  pointer-events: none;
}

.trend__tip span {
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
