<script setup lang="ts">
import { computed } from 'vue'
import { useTween } from '@/composables/useTween'
import {
  angleFor,
  arcPath,
  END_DEG,
  needlePolygon,
  needleTipPolygon,
  numerals,
  polar,
  R,
  READOUT,
  START_DEG,
  ticks,
} from '@/lib/instruments/geometry'

/**
 * A printed dial: bezel ring, matte face, fine ticks with numerals, thin
 * caution/critical segments on the scale like a tachometer redline, a thin
 * flat amber value arc over a quiet track, and a slim tapered needle.
 *
 * Drawn in unit space and scaled by the viewBox, so it is the same drawing at
 * every size. Flat by rule: no gradients, glows, blurs or shadows.
 */
const props = withDefaults(
  defineProps<{
    /** Raw value; the needle pins at the scale's ends, the readout does not. */
    value: number | null
    min?: number
    max: number
    majorStep: number
    minorStep: number
    numeralStep: number
    formatNumeral?: (value: number) => string
    bands?: { from: number; to: number; tone: 'critical' | 'caution' }[]
    /** A printed reference mark, e.g. expected-to-date. */
    marker?: number | null
    readout: string
    unit?: string
    caption: string
    /** Full sentence for screen readers. */
    label: string
    size?: 'hero' | 'small'
  }>(),
  { min: 0, formatNumeral: (v: number) => String(v), bands: () => [], marker: null, unit: '', size: 'small' },
)

/** Drawing scale: unit geometry × 100, so text sizes are whole user units. */
const S = 100
const at = (p: { x: number; y: number }) => ({ x: p.x * S, y: p.y * S })

const shown = useTween(() => props.value)

const needleDeg = computed(() => angleFor(shown.value ?? props.min, props.min, props.max))
const hasValue = computed(() => props.value !== null)

const tickMarks = computed(() =>
  ticks(props.min, props.max, props.majorStep, props.minorStep).map((t) => ({ ...t, inner: at(t.inner), outer: at(t.outer) })),
)
const numeralMarks = computed(() =>
  numerals(props.min, props.max, props.numeralStep, props.formatNumeral).map((n) => ({ ...n, at: at(n.at) })),
)

const bandPaths = computed(() =>
  props.bands
    .filter((band) => band.to > band.from)
    .map((band) => ({
      tone: band.tone,
      d: arcPath(R.band * S, angleFor(band.from, props.min, props.max), angleFor(Math.min(band.to, props.max), props.min, props.max)),
    })),
)

const trackPath = arcPath(R.arc * S, START_DEG, END_DEG)
const valuePath = computed(() => (hasValue.value ? arcPath(R.arc * S, START_DEG, needleDeg.value) : ''))

const markerLine = computed(() => {
  if (props.marker === null || props.marker === undefined) return null
  const deg = angleFor(props.marker, props.min, props.max)
  return { a: at(polar(R.arc - 0.06, deg)), b: at(polar(R.tickOuter, deg)) }
})

// The readout shrinks for long strings so it never leaves the wedge.
const readoutSize = computed(() => {
  const chars = props.readout.length + props.unit.length * 0.55
  return S * Math.min(0.3, READOUT.width / Math.max(chars * 0.56, 1))
})

const readoutY = S * (READOUT.y + READOUT.height * 0.5)
const captionY = S * (READOUT.y + READOUT.height * 0.9)
</script>

<template>
  <svg
    class="dial"
    :class="[`dial--${size}`, { 'dial--empty': !hasValue }]"
    viewBox="-106 -106 212 212"
    role="img"
    :aria-label="label"
  >
    <title>{{ label }}</title>

    <circle class="dial__bezel" r="103.5" />
    <circle class="dial__face" r="100" />

    <path v-for="(band, i) in bandPaths" :key="i" :d="band.d" class="dial__band" :class="`is-${band.tone}`" />

    <g class="dial__ticks">
      <line
        v-for="tick in tickMarks"
        :key="tick.value"
        :x1="tick.inner.x"
        :y1="tick.inner.y"
        :x2="tick.outer.x"
        :y2="tick.outer.y"
        :class="tick.major ? 'is-major' : 'is-minor'"
      />
    </g>

    <g class="dial__numerals">
      <text v-for="n in numeralMarks" :key="n.value" :x="n.at.x" :y="n.at.y">{{ n.text }}</text>
    </g>

    <path :d="trackPath" class="dial__track" />
    <path v-if="valuePath" :d="valuePath" class="dial__value" />

    <line
      v-if="markerLine"
      class="dial__marker"
      :x1="markerLine.a.x"
      :y1="markerLine.a.y"
      :x2="markerLine.b.x"
      :y2="markerLine.b.y"
    />

    <g class="dial__needle">
      <polygon :points="needlePolygon(needleDeg, S)" class="dial__shaft" />
      <polygon v-if="hasValue" :points="needleTipPolygon(needleDeg, S)" class="dial__tip" />
      <circle :r="R.hub * S" class="dial__hub" />
      <circle r="2.4" class="dial__pin" />
    </g>

    <g class="dial__readout" aria-hidden="true">
      <text class="dial__value-text" x="0" :y="readoutY" :font-size="readoutSize">
        {{ readout }}<tspan v-if="unit" class="dial__unit" :font-size="readoutSize * 0.5" dx="2">{{ unit }}</tspan>
      </text>
      <text class="dial__caption" x="0" :y="captionY">{{ caption }}</text>
    </g>
  </svg>
</template>

<style scoped>
.dial {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
  font-family: var(--font-face);
  font-variant-numeric: tabular-nums;
}

.dial__bezel {
  fill: none;
  stroke: rgb(var(--v-theme-line-strong));
  stroke-width: 1.2;
}

.dial__face {
  fill: rgb(var(--v-theme-dial-face));
  stroke: rgb(var(--v-theme-line));
  stroke-width: 0.8;
}

.dial__band {
  fill: none;
  stroke-width: 2;
  stroke-linecap: butt;
}

.dial__band.is-critical {
  stroke: rgb(var(--v-theme-critical));
}

.dial__band.is-caution {
  stroke: rgb(var(--v-theme-caution));
}

.dial__ticks line {
  stroke-linecap: butt;
}

.dial__ticks .is-major {
  stroke: rgb(var(--v-theme-ink-2));
  stroke-width: 1.6;
}

.dial__ticks .is-minor {
  stroke: rgb(var(--v-theme-ink-3));
  stroke-width: 0.8;
}

.dial__numerals text {
  fill: rgb(var(--v-theme-ink-2));
  font-size: 10.5px;
  font-weight: 500;
  text-anchor: middle;
  dominant-baseline: central;
}

.dial--small .dial__numerals text {
  font-size: 13px;
}

.dial__track {
  fill: none;
  stroke: rgb(var(--v-theme-track));
  stroke-width: 2.6;
}

.dial__value {
  fill: none;
  stroke: rgb(var(--v-theme-accent));
  stroke-width: 2.6;
  stroke-linecap: butt;
}

.dial__marker {
  stroke: rgb(var(--v-theme-ink));
  stroke-width: 2.2;
}

.dial__shaft {
  fill: rgb(var(--v-theme-ink-2));
}

.dial__tip {
  fill: rgb(var(--v-theme-accent));
}

.dial__hub {
  fill: rgb(var(--v-theme-surface));
  stroke: rgb(var(--v-theme-line-strong));
  stroke-width: 1.2;
}

.dial__pin {
  fill: rgb(var(--v-theme-ink-2));
}

.dial__value-text {
  fill: rgb(var(--v-theme-ink));
  font-weight: 600;
  text-anchor: middle;
  dominant-baseline: central;
  letter-spacing: -0.01em;
}

.dial--empty .dial__value-text {
  fill: rgb(var(--v-theme-ink-2));
  font-weight: 500;
}

.dial__unit {
  fill: rgb(var(--v-theme-ink-2));
  font-weight: 500;
}

.dial__caption {
  fill: rgb(var(--v-theme-ink-2));
  font-family: var(--font-label);
  font-size: 6.8px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-anchor: middle;
  dominant-baseline: central;
}

.dial--small .dial__caption {
  font-size: 8.5px;
}
</style>
