import type { AdminTarget, MetricSettings, PersonPeriod, TargetField, TargetValues } from './types'
import type { Centavos } from './money'

/* ---------------------------------------------------------------------------
 * TARGETS come from data, never from code. (The source workbook hardcodes
 * 350,000 and 983,333.33 into its formulas; nothing here does.)
 *
 * Per field, the first value set wins:
 *   1. an admin target for this person and quarter
 *   2. the target printed in the uploaded workbook
 *   3. an admin default for the person's position in their area
 *   4. an admin default for the person's position
 *
 * All values are QUARTER targets. A month's target is a third of it.
 * ------------------------------------------------------------------------- */

export type TargetSource = 'person' | 'file' | 'position_area' | 'position' | 'derived'

export interface ResolvedTargets {
  values: TargetValues
  sources: Record<TargetField, TargetSource | null>
  /** Combi target set, both parts set, and they don't add up (₱4M vs ₱3M + ₱1.5M). */
  partsMismatch: boolean
}

const FIELDS: TargetField[] = ['inhouse', 'ethical', 'combi', 'calls']

export const EMPTY_TARGETS: TargetValues = { inhouse: null, ethical: null, combi: null, calls: null }

export function resolveTargets(
  person: Pick<PersonPeriod, 'personId' | 'position' | 'area' | 'fileTargets'>,
  adminTargets: readonly AdminTarget[],
  settings: Pick<MetricSettings, 'combiFallback' | 'fileCallsBasis'>,
): ResolvedTargets {
  const own = adminTargets.find((t) => t.scope === 'person' && t.personId === person.personId)
  const byArea = adminTargets.find(
    (t) => t.scope === 'position_area' && t.position === person.position && t.area === person.area,
  )
  const byPosition = adminTargets.find((t) => t.scope === 'position' && t.position === person.position)

  // The workbook's calls target may be monthly (160) rather than quarterly (480).
  const file: TargetValues = {
    ...person.fileTargets,
    calls:
      person.fileTargets.calls !== null && settings.fileCallsBasis === 'month'
        ? person.fileTargets.calls * 3
        : person.fileTargets.calls,
  }

  const layers: [TargetSource, Partial<TargetValues> | undefined][] = [
    ['person', own],
    ['file', file],
    ['position_area', byArea],
    ['position', byPosition],
  ]

  const values: TargetValues = { ...EMPTY_TARGETS }
  const sources: Record<TargetField, TargetSource | null> = { inhouse: null, ethical: null, combi: null, calls: null }
  for (const field of FIELDS) {
    for (const [source, layer] of layers) {
      const value = layer?.[field]
      if (value !== null && value !== undefined) {
        values[field] = value
        sources[field] = source
        break
      }
    }
  }

  if (values.combi === null && values.inhouse !== null && values.ethical !== null && settings.combiFallback === 'sum') {
    values.combi = values.inhouse + values.ethical
    sources.combi = 'derived'
  }

  const partsMismatch =
    values.combi !== null &&
    values.inhouse !== null &&
    values.ethical !== null &&
    sources.combi !== 'derived' &&
    values.combi !== values.inhouse + values.ethical

  return { values, sources, partsMismatch }
}

/** A person is measured — ranked and counted in attainment — when they have a combi target. */
export function isMeasured(targets: TargetValues, settings: Pick<MetricSettings, 'rankRequiresTarget'>): boolean {
  return !settings.rankRequiresTarget || (targets.combi !== null && targets.combi > 0)
}

/** Monthly target for display. Calculations use the exact quarter / 3 instead. */
export function monthlyTarget(quarterTarget: Centavos | null): Centavos | null {
  return quarterTarget === null ? null : Math.round(quarterTarget / 3)
}
