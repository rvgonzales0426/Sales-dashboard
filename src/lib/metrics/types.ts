import type { Area, Position, QuarterMonth } from '@/types/sales'
import type { Centavos } from './money'

/* ---------------------------------------------------------------------------
 * The metrics library's view of the world. Everything here is computed from
 * stored INPUTS (in-house, ethical, calls, targets); nothing computed is ever
 * stored. All money is integer centavos.
 * ------------------------------------------------------------------------- */

export interface MonthInputs {
  inhouse: Centavos
  ethical: Centavos
  calls: number
}

export interface TargetValues {
  inhouse: Centavos | null
  ethical: Centavos | null
  combi: Centavos | null
  calls: number | null
}

export type TargetField = keyof TargetValues

/** One person in one quarter's current snapshot. */
export interface PersonPeriod {
  personId: string
  lastName: string
  firstName: string
  position: Position
  area: Area
  /** Only months that have data in the snapshot. */
  months: Partial<Record<QuarterMonth, MonthInputs>>
  /** Targets printed in the workbook (quarter figures, or monthly — see settings). */
  fileTargets: TargetValues
}

/** An admin-set target (public.targets), already in centavos. */
export interface AdminTarget {
  scope: 'person' | 'position_area' | 'position'
  personId: string | null
  position: Position | null
  area: Area | null
  inhouse: Centavos | null
  ethical: Centavos | null
  combi: Centavos | null
  calls: number | null
}

export interface MetricSettings {
  /** ≥ this share of expected-to-date is on pace. */
  onPace: number
  /** ≥ this (and below onPace) is at risk; below is behind. */
  atRisk: number
  /** Calls below this share of expected-to-date light the "calls low" lamp. */
  callsLow: number
  /** Missing combi target with both parts set: derive it, or leave it unset. */
  combiFallback: 'sum' | 'none'
  /** Is the workbook's CALLS target for the quarter or for one month? */
  fileCallsBasis: 'quarter' | 'month'
  /** People without a target are left out of attainment and rankings. */
  rankRequiresTarget: boolean
}

export const DEFAULT_SETTINGS: MetricSettings = {
  onPace: 1,
  atRisk: 0.7,
  callsLow: 0.7,
  combiFallback: 'sum',
  fileCallsBasis: 'quarter',
  rankRequiresTarget: true,
}

/** Quarter-to-date (the default), or a single month. */
export type PeriodSelection = { kind: 'qtd' } | { kind: 'month'; month: QuarterMonth }

export type PaceStatus = 'ahead' | 'on_pace' | 'at_risk' | 'behind' | 'no_target' | 'no_data'

export interface MetricValues {
  inhouse: Centavos
  ethical: Centavos
  combi: Centavos
  calls: number
}

export interface Attainments {
  inhouse: number | null
  ethical: number | null
  combi: number | null
  calls: number | null
}
