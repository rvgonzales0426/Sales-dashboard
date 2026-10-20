/* ---------------------------------------------------------------------------
 * DIAL GEOMETRY — pure functions, in a unit dial (centre 0,0, radius 1, y
 * down like SVG). Components scale it with a viewBox, so a gauge is the same
 * drawing at every size and the overlap guarantees below hold at all sizes.
 *
 * Angles are degrees clockwise from 12 o'clock. The scale runs 240° from
 * -120° (about 8 o'clock) to +120° (4 o'clock), leaving a 120° open wedge at
 * the bottom. The digital readout lives in that wedge — never under the needle
 * sweep — and tests/unit/instruments/geometry.test.ts proves it for every
 * needle position.
 * ------------------------------------------------------------------------- */

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export const START_DEG = -120
export const SWEEP_DEG = 240
export const END_DEG = START_DEG + SWEEP_DEG

/** Radii, as fractions of the dial radius. Inner to outer. */
export const R = {
  hub: 0.075,
  tail: 0.2,
  needle: 0.84,
  arc: 0.73,
  numerals: 0.6,
  tickInner: 0.8,
  tickMinorInner: 0.86,
  tickOuter: 0.93,
  band: 0.955,
  face: 1,
} as const

/**
 * The readout box, inside the open wedge: below the needle's tail at its
 * longest, inside the wedge's 30°-below-horizontal rays with margin, and
 * clear of the 0 and max numerals that sit at the wedge's top corners.
 */
export const READOUT: Rect = { x: -0.42, y: 0.4, width: 0.84, height: 0.44 }

export function polar(radius: number, deg: number): Point {
  const rad = (deg * Math.PI) / 180
  return { x: radius * Math.sin(rad), y: -radius * Math.cos(rad) }
}

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

/** Value → needle angle, pinned to the ends of the scale. */
export function angleFor(value: number, min: number, max: number): number {
  const t = max === min ? 0 : (clamp(value, min, max) - min) / (max - min)
  return START_DEG + t * SWEEP_DEG
}

/** An SVG arc path along `radius` from one angle to another (clockwise). */
export function arcPath(radius: number, fromDeg: number, toDeg: number): string {
  const from = polar(radius, fromDeg)
  const to = polar(radius, toDeg)
  const span = toDeg - fromDeg
  if (Math.abs(span) < 1e-6) return ''
  const large = Math.abs(span) > 180 ? 1 : 0
  const sweep = span > 0 ? 1 : 0
  return `M ${from.x.toFixed(4)} ${from.y.toFixed(4)} A ${radius} ${radius} 0 ${large} ${sweep} ${to.x.toFixed(4)} ${to.y.toFixed(4)}`
}

export interface Tick {
  value: number
  deg: number
  major: boolean
  inner: Point
  outer: Point
}

export interface Numeral {
  value: number
  deg: number
  at: Point
  text: string
}

export function ticks(min: number, max: number, majorStep: number, minorStep: number): Tick[] {
  const out: Tick[] = []
  const count = Math.round((max - min) / minorStep)
  for (let i = 0; i <= count; i++) {
    const value = min + i * minorStep
    const major = Math.abs(((value - min) / majorStep) % 1) < 1e-9 || Math.abs((((value - min) / majorStep) % 1) - 1) < 1e-9
    const deg = angleFor(value, min, max)
    out.push({
      value,
      deg,
      major,
      inner: polar(major ? R.tickInner : R.tickMinorInner, deg),
      outer: polar(R.tickOuter, deg),
    })
  }
  return out
}

export function numerals(min: number, max: number, step: number, format: (v: number) => string = String): Numeral[] {
  const out: Numeral[] = []
  for (let value = min; value <= max + 1e-9; value += step) {
    const deg = angleFor(value, min, max)
    out.push({ value, deg, at: polar(R.numerals, deg), text: format(Math.round(value * 1e6) / 1e6) })
  }
  return out
}

/** The needle as a tapered polygon: counterweight tail, slim shaft, fine tip. */
export function needlePolygon(deg: number, scale = 1, widthAtHub = 0.034, widthAtTip = 0.008): string {
  const forward = polar(scale, deg)
  const side = { x: -forward.y / scale, y: forward.x / scale }
  const at = (along: number, half: number) => ({
    x: forward.x * along + side.x * half,
    y: forward.y * along + side.y * half,
  })
  const points = [
    at(-R.tail, widthAtHub * 0.9 * scale),
    at(R.needle, (widthAtTip / 2) * scale),
    at(R.needle, (-widthAtTip / 2) * scale),
    at(-R.tail, -widthAtHub * 0.9 * scale),
  ]
  return points.map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`).join(' ')
}

/** The amber tip: the outer quarter of the needle, drawn over the shaft. */
export function needleTipPolygon(deg: number, scale = 1, widthAtTip = 0.008): string {
  const forward = polar(scale, deg)
  const side = { x: -forward.y / scale, y: forward.x / scale }
  const start = R.needle * 0.68
  const halfStart = ((0.034 - (0.034 - widthAtTip) * ((start + R.tail) / (R.needle + R.tail))) / 2) * scale
  const at = (along: number, half: number) => ({ x: forward.x * along + side.x * half, y: forward.y * along + side.y * half })
  const tip = (widthAtTip / 2) * scale
  return [at(start, halfStart), at(R.needle, tip), at(R.needle, -tip), at(start, -halfStart)]
    .map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`)
    .join(' ')
}

/* ----- Overlap checks (used by the tests and the gallery) ----------------- */

/** Does segment ab cross (or touch) the rectangle? */
export function segmentHitsRect(a: Point, b: Point, rect: Rect, pad = 0): boolean {
  const left = rect.x - pad
  const right = rect.x + rect.width + pad
  const top = rect.y - pad
  const bottom = rect.y + rect.height + pad
  const inside = (p: Point) => p.x >= left && p.x <= right && p.y >= top && p.y <= bottom
  if (inside(a) || inside(b)) return true
  const edges: [Point, Point][] = [
    [{ x: left, y: top }, { x: right, y: top }],
    [{ x: right, y: top }, { x: right, y: bottom }],
    [{ x: right, y: bottom }, { x: left, y: bottom }],
    [{ x: left, y: bottom }, { x: left, y: top }],
  ]
  const cross = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  return edges.some(([c, d]) => {
    const d1 = cross(c, d, a)
    const d2 = cross(c, d, b)
    const d3 = cross(a, b, c)
    const d4 = cross(a, b, d)
    return d1 * d2 <= 0 && d3 * d4 <= 0
  })
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

/** The needle's full length at an angle, tail to tip, as a segment. */
export function needleSegment(deg: number): [Point, Point] {
  return [polar(-R.tail, deg), polar(R.needle, deg)]
}

/** Approximate box of a numeral centred at `at`, sized for the dial's font. */
export function numeralBox(at: Point, text: string, fontSize = 0.11): Rect {
  const width = text.length * fontSize * 0.58
  return { x: at.x - width / 2, y: at.y - fontSize / 2, width, height: fontSize }
}

/** A round step for a scale: 1, 2, 2.5 or 5 × 10^n, near range / count. */
export function niceStep(range: number, count: number): number {
  const raw = range / Math.max(count, 1)
  if (raw <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const n = raw / magnitude
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10
  return step * magnitude
}

/** A scale maximum that is a whole number of nice steps. */
export function niceMax(value: number, count = 5): { max: number; step: number } {
  const step = niceStep(Math.max(value, 1), count)
  return { max: Math.ceil(Math.max(value, 1) / step) * step, step }
}
