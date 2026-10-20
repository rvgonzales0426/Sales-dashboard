<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useAreaChart, formatCompact, type ChartPoint } from '@/composables/useAreaChart'

const props = defineProps<{
  points: ChartPoint[]
  /** Names the series — a single-series chart needs no legend, the title says it. */
  seriesLabel: string
  loading?: boolean
}>()

const {
  container,
  width,
  height,
  pad,
  innerHeight,
  linePath,
  areaPath,
  yTicks,
  xTicks,
  hovered,
  onPointerMove,
  onPointerLeave,
} = useAreaChart(toRef(props, 'points'), { height: 260 })

const baseline = computed(() => pad.top + innerHeight)
const last = computed(() => (props.points.length ? props.points[props.points.length - 1] : null))
</script>

<template>
  <div ref="container" class="chart">
    <div v-if="loading" class="chart__loading">
      <div class="chart__loading-bar" v-for="n in 12" :key="n" :style="{ height: `${20 + ((n * 37) % 60)}%` }" />
    </div>

    <svg
      v-else
      class="chart__svg"
      :width="width"
      :height="height"
      role="img"
      :aria-label="`${seriesLabel} over the last ${points.length} periods`"
      @pointermove="onPointerMove"
      @pointerleave="onPointerLeave"
    >
      <!-- Gridlines: solid hairlines, one step off the surface. Never dashed. -->
      <g class="chart__grid">
        <line
          v-for="tick in yTicks"
          :key="`grid-${tick.value}`"
          :x1="pad.left"
          :x2="width - pad.right"
          :y1="tick.y"
          :y2="tick.y"
        />
      </g>

      <!-- Axis labels wear text tokens, never the series colour. -->
      <g class="chart__axis-text">
        <text
          v-for="tick in yTicks"
          :key="`y-${tick.value}`"
          :x="pad.left - 10"
          :y="tick.y + 4"
          text-anchor="end"
        >
          {{ tick.label }}
        </text>
        <text
          v-for="tick in xTicks"
          :key="`x-${tick.label}`"
          :x="tick.x"
          :y="baseline + 18"
          text-anchor="middle"
        >
          {{ tick.label }}
        </text>
      </g>

      <path class="chart__area" :d="areaPath" />
      <path class="chart__line" :d="linePath" />

      <!-- End marker with a surface ring, so it stays legible over the line. -->
      <circle
        v-if="!hovered && xTicks.length"
        class="chart__marker"
        :cx="xTicks[xTicks.length - 1].x"
        :cy="xTicks[xTicks.length - 1].y"
        r="4"
      />

      <g v-if="hovered">
        <line
          class="chart__crosshair"
          :x1="hovered.x"
          :x2="hovered.x"
          :y1="pad.top"
          :y2="baseline"
        />
        <circle class="chart__marker" :cx="hovered.x" :cy="hovered.y" r="4.5" />
      </g>
    </svg>

    <div
      v-if="hovered"
      class="chart__tooltip"
      :style="{ left: `${hovered.x}px`, top: `${hovered.y - 14}px` }"
    >
      <div class="chart__tooltip-value">{{ formatCompact(hovered.value) }}</div>
      <div class="chart__tooltip-label">{{ hovered.label }}</div>
    </div>

    <div v-if="last && !loading" class="chart__footnote">
      Latest: {{ formatCompact(last.value) }} {{ seriesLabel.toLowerCase() }}
    </div>
  </div>
</template>

<style scoped>
.chart {
  position: relative;
  width: 100%;
}

.chart__svg {
  display: block;
  touch-action: none;
}

.chart__grid line {
  stroke: rgb(var(--v-chart-grid));
  stroke-width: 1;
  shape-rendering: crispEdges;
}

.chart__axis-text text {
  fill: rgb(var(--v-theme-text-secondary));
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.chart__area {
  fill: rgb(var(--v-chart-1));
  fill-opacity: 0.1;
}

.chart__line {
  fill: none;
  stroke: rgb(var(--v-chart-1));
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.chart__marker {
  fill: rgb(var(--v-chart-1));
  stroke: rgb(var(--v-theme-surface));
  stroke-width: 2;
}

.chart__crosshair {
  stroke: rgb(var(--v-chart-axis));
  stroke-width: 1;
}

.chart__tooltip {
  position: absolute;
  transform: translate(-50%, -100%);
  pointer-events: none;
  padding: 7px 10px;
  border-radius: 8px;
  background-color: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  box-shadow: 0 4px 14px -4px rgba(9, 12, 11, 0.18);
  white-space: nowrap;
}

.chart__tooltip-value {
  font-size: 0.8125rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.chart__tooltip-label {
  font-size: 0.6875rem;
  color: rgb(var(--v-theme-text-secondary));
}

.chart__footnote {
  margin-top: 10px;
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-text-secondary));
}

.chart__loading {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 260px;
  padding: 16px 16px 44px;
}

.chart__loading-bar {
  flex: 1;
  border-radius: 4px 4px 0 0;
  background-color: rgb(var(--v-theme-surface-variant));
  animation: chart-pulse 1.4s ease-in-out infinite;
}

@keyframes chart-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

@media (prefers-reduced-motion: reduce) {
  .chart__loading-bar {
    animation: none;
  }
}
</style>
