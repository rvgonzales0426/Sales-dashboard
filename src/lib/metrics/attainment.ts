/* ---------------------------------------------------------------------------
 * ATTAINMENT = actual ÷ target. That is all it is.
 *
 * What the source workbook does instead, and why it is wrong:
 *   combi    (ethical/350000) × (inhouse/983333.33)  — multiplies two ratios,
 *            so 50% and 50% reads as 25%. Correct: combi actual ÷ combi target.
 *   calls    quarterly calls ÷ 160 (the MONTHLY target). Correct: ÷ 480.
 *
 * No target (missing, or 0) gives null — shown as "—", never 0% or Infinity.
 * ------------------------------------------------------------------------- */

export function attainment(actual: number, target: number | null | undefined): number | null {
  if (target === null || target === undefined || !Number.isFinite(target) || target <= 0) return null
  return actual / target
}

/**
 * Attainment against `share` of a quarter target, exactly: a month is 1/3, two
 * months 2/3. Computed as (actual × 3) ÷ (target × months) so no rounded
 * monthly target ever enters the division.
 */
export function attainmentOfShare(
  actual: number,
  quarterTarget: number | null | undefined,
  monthsOfQuarter: number,
): number | null {
  if (quarterTarget === null || quarterTarget === undefined || monthsOfQuarter <= 0) return null
  return attainment(actual * 3, quarterTarget * monthsOfQuarter)
}

/** Where a needle points: attainment pinned to the dial's end; the readout keeps the truth. */
export function pinned(ratio: number | null, max: number): number | null {
  if (ratio === null) return null
  return Math.min(Math.max(ratio, 0), max)
}
