import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

export interface ChartPoint {
  label: string
  value: number
}

interface Options {
  height?: number
  /** Roughly how many x labels to draw. Fewer on narrow screens. */
  maxXLabels?: number
}

const PAD = { top: 16, right: 16, bottom: 28, left: 44 }

/** Rounds an axis maximum up to a clean number (1 / 2 / 2.5 / 5 x 10^n). */
function niceMax(value: number): number {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10
  return step * magnitude
}

export function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(value % 1000 === 0 ? 0 : 1)}K`
  return value.toLocaleString()
}

/**
 * Geometry for a single-series area chart. Everything is computed in real
 * pixels off the measured container width, so strokes stay 2px and text stays
 * upright at any size — which a scaled viewBox cannot promise.
 */
export function useAreaChart(points: Ref<ChartPoint[]>, options: Options = {}) {
  const height = options.height ?? 260
  const container = ref<HTMLElement | null>(null)
  const width = ref(720)
  const hoverIndex = ref<number | null>(null)

  let observer: ResizeObserver | null = null

  onMounted(() => {
    if (!container.value) return
    observer = new ResizeObserver(([entry]) => {
      width.value = Math.max(280, entry.contentRect.width)
    })
    observer.observe(container.value)
    width.value = Math.max(280, container.value.clientWidth)
  })

  onBeforeUnmount(() => observer?.disconnect())

  const innerWidth = computed(() => width.value - PAD.left - PAD.right)
  const innerHeight = height - PAD.top - PAD.bottom

  const yMax = computed(() => niceMax(Math.max(...points.value.map((p) => p.value), 1)))

  const xFor = (index: number) => {
    const count = points.value.length
    if (count <= 1) return PAD.left + innerWidth.value / 2
    return PAD.left + (index / (count - 1)) * innerWidth.value
  }

  const yFor = (value: number) => PAD.top + innerHeight - (value / yMax.value) * innerHeight

  const coords = computed(() => points.value.map((p, i) => ({ ...p, x: xFor(i), y: yFor(p.value) })))

  const linePath = computed(() =>
    coords.value.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '),
  )

  const areaPath = computed(() => {
    if (!coords.value.length) return ''
    const baseline = PAD.top + innerHeight
    const first = coords.value[0]
    const last = coords.value[coords.value.length - 1]
    return `${linePath.value} L${last.x.toFixed(2)},${baseline} L${first.x.toFixed(2)},${baseline} Z`
  })

  /** Four gridlines including the baseline — enough to read against, no more. */
  const yTicks = computed(() =>
    [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      value: yMax.value * ratio,
      label: formatCompact(Math.round(yMax.value * ratio)),
      y: yFor(yMax.value * ratio),
    })),
  )

  const xTicks = computed(() => {
    const max = options.maxXLabels ?? (width.value < 520 ? 4 : 7)
    const stride = Math.max(1, Math.ceil(points.value.length / max))
    return coords.value.filter((_, index) => index % stride === 0 || index === coords.value.length - 1)
  })

  const hovered = computed(() => (hoverIndex.value === null ? null : coords.value[hoverIndex.value]))

  function onPointerMove(event: PointerEvent) {
    const bounds = (event.currentTarget as SVGElement).getBoundingClientRect()
    const x = event.clientX - bounds.left
    let nearest = 0
    let smallest = Infinity
    coords.value.forEach((point, index) => {
      const distance = Math.abs(point.x - x)
      if (distance < smallest) {
        smallest = distance
        nearest = index
      }
    })
    hoverIndex.value = nearest
  }

  return {
    container,
    width,
    height,
    pad: PAD,
    innerHeight,
    linePath,
    areaPath,
    coords,
    yTicks,
    xTicks,
    hovered,
    hoverIndex,
    onPointerMove,
    onPointerLeave: () => (hoverIndex.value = null),
  }
}
