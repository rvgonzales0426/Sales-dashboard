import { formatCount, formatPercent } from './money'
import type { PersonMetrics, TeamMetrics } from './aggregate'
import type { MetricSettings } from './types'

/* ---------------------------------------------------------------------------
 * TELL-TALES — the warning lamps. Each has a pictogram AND a text label in
 * the UI; tone is never the only signal.
 * ------------------------------------------------------------------------- */

export type TellTaleKey = 'behind_pace' | 'no_inhouse' | 'no_ethical' | 'calls_low'

export interface TellTale {
  key: TellTaleKey
  label: string
  lit: boolean
  tone: 'caution' | 'critical'
  /** One short line: why it is lit, or what is fine. */
  detail: string
}

export const TELLTALE_LABEL: Record<TellTaleKey, string> = {
  behind_pace: 'Behind pace',
  no_inhouse: 'No in-house',
  no_ethical: 'No ethical',
  calls_low: 'Calls low',
}

const peopleCount = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`

function paceLamp(pace: PersonMetrics['pace'], hasData: boolean): TellTale {
  const lit = hasData && (pace.status === 'behind' || pace.status === 'at_risk')
  return {
    key: 'behind_pace',
    label: TELLTALE_LABEL.behind_pace,
    lit,
    tone: pace.status === 'behind' ? 'critical' : 'caution',
    detail: !hasData
      ? 'No data yet'
      : pace.ratio === null
        ? 'No target set'
        : `${formatPercent(pace.ratio)} of expected`,
  }
}

function callsLamp(callsPace: PersonMetrics['callsPace'], hasData: boolean, settings: MetricSettings): TellTale {
  const lit = hasData && callsPace.ratio !== null && callsPace.ratio < settings.callsLow
  return {
    key: 'calls_low',
    label: TELLTALE_LABEL.calls_low,
    lit,
    tone: callsPace.ratio !== null && callsPace.ratio < settings.atRisk ? 'critical' : 'caution',
    detail: !hasData ? 'No data yet' : callsPace.ratio === null ? 'No calls target' : `${formatPercent(callsPace.ratio)} of expected`,
  }
}

export function personTellTales(person: PersonMetrics, settings: MetricSettings): TellTale[] {
  const noInhouse = person.hasData && person.toDate.inhouse <= 0
  const noEthical = person.hasData && person.toDate.ethical <= 0
  return [
    paceLamp(person.pace, person.hasData && person.measured),
    { key: 'no_inhouse', label: TELLTALE_LABEL.no_inhouse, lit: noInhouse, tone: 'caution', detail: noInhouse ? 'Nothing collected yet' : 'Collecting' },
    { key: 'no_ethical', label: TELLTALE_LABEL.no_ethical, lit: noEthical, tone: 'caution', detail: noEthical ? 'Nothing collected yet' : 'Collecting' },
    callsLamp(person.callsPace, person.hasData, settings),
  ]
}

export function teamTellTales(team: TeamMetrics, people: readonly PersonMetrics[], settings: MetricSettings): TellTale[] {
  const measured = people.filter((p) => p.measured && p.hasData)
  const withoutInhouse = measured.filter((p) => p.toDate.inhouse <= 0).length
  const withoutEthical = measured.filter((p) => p.toDate.ethical <= 0).length
  const lowCalls = measured.filter((p) => p.callsPace.ratio !== null && p.callsPace.ratio < settings.callsLow).length
  const calls = callsLamp(team.callsPace, team.hasData, settings)
  return [
    paceLamp(team.pace, team.hasData && team.measuredCount > 0),
    {
      key: 'no_inhouse',
      label: TELLTALE_LABEL.no_inhouse,
      lit: withoutInhouse > 0,
      tone: 'caution',
      detail: withoutInhouse ? `${peopleCount(withoutInhouse)} at ₱0` : 'Everyone collecting',
    },
    {
      key: 'no_ethical',
      label: TELLTALE_LABEL.no_ethical,
      lit: withoutEthical > 0,
      tone: 'caution',
      detail: withoutEthical ? `${peopleCount(withoutEthical)} at ₱0` : 'Everyone collecting',
    },
    { ...calls, detail: lowCalls ? `${calls.detail} · ${formatCount(lowCalls)} below ${formatPercent(settings.callsLow)}` : calls.detail },
  ]
}
