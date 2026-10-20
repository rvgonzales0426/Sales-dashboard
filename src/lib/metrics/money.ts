/**
 * Money is handled as integer CENTAVOS end to end. A float never takes part in
 * arithmetic: values are converted once at the edge (the workbook, the API)
 * and converted back only for display.
 *
 * numeric(14,2) tops out below 10^14 centavos, comfortably inside
 * Number.MAX_SAFE_INTEGER (9 × 10^15), so plain numbers are exact here.
 */

export type Centavos = number

export const EM_DASH = '—'

/**
 * Pesos (as Excel or PostgREST hand them over) to whole centavos, rounding
 * half away from zero on the DECIMAL value. 0.285 is 0.28499999999999998 in
 * binary; toPrecision(15) recovers the 0.285 a person typed, so it rounds to
 * 29 centavos rather than 28.
 */
export function toCentavos(pesos: number): Centavos {
  if (!Number.isFinite(pesos)) throw new RangeError(`Not a finite amount: ${pesos}`)
  const scaled = Number((Math.abs(pesos) * 100).toPrecision(15))
  const rounded = Math.round(scaled)
  return pesos < 0 ? -rounded : rounded
}

/** Centavos to pesos, for the API (exact for any value we can store). */
export function toPesos(centavos: Centavos): number {
  return centavos / 100
}

export function sumCentavos(values: readonly Centavos[]): Centavos {
  let total = 0
  for (const value of values) total += value
  return total
}

const pesoFull = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const pesoWhole = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** ₱245,649.86 — the full value, for odometers, tooltips and tables. */
export function formatPeso(centavos: Centavos | null | undefined, options: { whole?: boolean } = {}): string {
  if (centavos === null || centavos === undefined) return EM_DASH
  const pesos = centavos / 100
  return options.whole ? pesoWhole.format(Math.round(pesos)) : pesoFull.format(pesos)
}

const COMPACT_STEPS = [
  { at: 1e9, suffix: 'B' },
  { at: 1e6, suffix: 'M' },
  { at: 1e3, suffix: 'K' },
] as const

/**
 * ₱12.4M — for tight spaces. Hand-rolled rather than Intl's compact notation
 * so every browser prints the same string.
 */
export function formatPesoCompact(centavos: Centavos | null | undefined): string {
  if (centavos === null || centavos === undefined) return EM_DASH
  const pesos = centavos / 100
  const sign = pesos < 0 ? '−' : ''
  const magnitude = Math.abs(pesos)
  for (const step of COMPACT_STEPS) {
    if (magnitude >= step.at) {
      const scaled = magnitude / step.at
      // 1 decimal below 100 (₱12.4M), none above (₱245K), never a trailing .0
      const digits = scaled >= 100 ? 0 : 1
      const text = scaled.toFixed(digits).replace(/\.0$/, '')
      return `${sign}₱${text}${step.suffix}`
    }
  }
  return `${sign}₱${Math.round(magnitude).toLocaleString('en-PH')}`
}

/** 0.1134 → "11%". null (no target) → em dash, never 0% or Infinity. */
export function formatPercent(ratio: number | null | undefined, decimals = 0): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return EM_DASH
  const value = ratio * 100
  const text = decimals > 0 ? value.toFixed(decimals) : String(Math.round(value))
  return `${text}%`
}

const countFormat = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 })

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EM_DASH
  return countFormat.format(value)
}
