import { attainmentOfShare } from './attainment'
import type { Centavos } from './money'
import type { MetricSettings, PaceStatus } from './types'

/* ---------------------------------------------------------------------------
 * PACE — are we where we should be by now?
 *
 *   expected to date = quarter target × (elapsed months ÷ 3)
 *   pace             = actual to date ÷ expected to date
 *
 *   ≥ on-pace (100%)   on pace (strictly above: ahead)
 *   ≥ at-risk (70%)    at risk
 *   below              behind
 *
 * Elapsed months are the months that have data, not the calendar: an upload
 * with October in it is measured against October, even if it's mid-November.
 * ------------------------------------------------------------------------- */

/** The latest month (1–3) with any data, or 0 when none has. */
export function elapsedMonths(monthsWithData: readonly number[]): number {
  return monthsWithData.length ? Math.max(...monthsWithData) : 0
}

/** Expected-to-date as a display amount (rounded once, at the end). */
export function expectedToDate(quarterTarget: number | null, elapsed: number): number | null {
  if (quarterTarget === null || elapsed <= 0) return null
  return Math.round((quarterTarget * elapsed) / 3)
}

export function paceRatio(actualToDate: number, quarterTarget: number | null, elapsed: number): number | null {
  return attainmentOfShare(actualToDate, quarterTarget, elapsed)
}

const EPSILON = 1e-9

export function paceStatus(
  ratio: number | null,
  hasData: boolean,
  settings: Pick<MetricSettings, 'onPace' | 'atRisk'>,
): PaceStatus {
  if (!hasData) return 'no_data'
  if (ratio === null) return 'no_target'
  if (ratio >= settings.onPace - EPSILON) return ratio > settings.onPace + EPSILON ? 'ahead' : 'on_pace'
  if (ratio >= settings.atRisk - EPSILON) return 'at_risk'
  return 'behind'
}

/**
 * CATCH-UP — how much is needed to be back on pace, carried forward: every
 * elapsed month's shortfall adds up, a surplus in one month offsets a later
 * shortfall, and the result never goes below zero (a surplus shows as ahead,
 * not as a negative catch-up).
 *
 * Integer arithmetic throughout: (target × elapsed − 3 × actual) ÷ 3.
 */
export function catchUp(actualToDate: Centavos, quarterTarget: Centavos | null, elapsed: number): Centavos | null {
  if (quarterTarget === null || elapsed <= 0) return null
  const shortfallTimesThree = quarterTarget * elapsed - actualToDate * 3
  return shortfallTimesThree <= 0 ? 0 : Math.round(shortfallTimesThree / 3)
}

/** Calls catch-up rounds up: nobody makes a third of a call. */
export function callsCatchUp(callsToDate: number, quarterTarget: number | null, elapsed: number): number | null {
  if (quarterTarget === null || elapsed <= 0) return null
  const shortfallTimesThree = quarterTarget * elapsed - callsToDate * 3
  return shortfallTimesThree <= 0 ? 0 : Math.ceil(shortfallTimesThree / 3)
}

/**
 * PROJECTION — at the current run rate, where does the quarter finish?
 * run rate = actual ÷ elapsed; projected = run rate × 3.
 */
export function projection(
  actualToDate: number,
  quarterTarget: number | null,
  elapsed: number,
): { amount: number | null; attainment: number | null } {
  if (elapsed <= 0) return { amount: null, attainment: null }
  const amount = Math.round((actualToDate * 3) / elapsed)
  return { amount, attainment: attainmentOfShare(actualToDate, quarterTarget, elapsed) }
}

export const PACE_LABEL: Record<PaceStatus, string> = {
  ahead: 'Ahead',
  on_pace: 'On pace',
  at_risk: 'At risk',
  behind: 'Behind',
  no_target: 'No target set',
  no_data: 'No data yet',
}

/** Status colour family. 'neutral' never uses a status colour. */
export const PACE_TONE: Record<PaceStatus, 'good' | 'caution' | 'critical' | 'neutral'> = {
  ahead: 'good',
  on_pace: 'good',
  at_risk: 'caution',
  behind: 'critical',
  no_target: 'neutral',
  no_data: 'neutral',
}
