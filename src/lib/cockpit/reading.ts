import {
  paceStatus,
  type Attainments,
  type MetricSettings,
  type MetricValues,
  type PaceStatus,
  type PersonMetrics,
  type TeamMetrics,
  type TellTale,
} from '@/lib/metrics'

/* ---------------------------------------------------------------------------
 * One shape for the cluster, whether it shows the team or one person, so the
 * same instruments render both.
 * ------------------------------------------------------------------------- */

export interface ClusterReading {
  hasData: boolean
  attainment: Attainments
  status: { combi: PaceStatus; inhouse: PaceStatus; ethical: PaceStatus; calls: PaceStatus }
  /** Share of the quarter expected by the selection's end (1 for a single month). */
  expectedShare: number
  calls: { actual: number | null; target: number | null }
  quota: { progress: number | null; actual: number | null; target: number | null }
  /** The odometer: everything collected in the selection, people without targets included. */
  collected: number | null
  catchUp: number | null
  projection: number | null
  telltales: TellTale[]
}

function statusOf(ratio: number | null, expectedShare: number, hasData: boolean, settings: MetricSettings): PaceStatus {
  return paceStatus(ratio === null ? null : ratio / expectedShare, hasData, settings)
}

function build(
  m: Pick<PersonMetrics, 'hasData' | 'attainment' | 'pace' | 'callsPace' | 'catchUp' | 'projection'>,
  toDate: MetricValues,
  collected: number,
  quarterTargets: { combi: number | null },
  callsActual: number,
  expectedShare: number,
  isMonth: boolean,
  settings: MetricSettings,
  telltales: TellTale[],
): ClusterReading {
  return {
    hasData: m.hasData,
    attainment: m.attainment,
    status: {
      combi: m.pace.status,
      inhouse: statusOf(m.attainment.inhouse, expectedShare, m.hasData, settings),
      ethical: statusOf(m.attainment.ethical, expectedShare, m.hasData, settings),
      calls: m.callsPace.status,
    },
    expectedShare,
    calls: { actual: m.hasData ? callsActual : null, target: m.callsPace.expected },
    quota: {
      progress: m.hasData && quarterTargets.combi ? toDate.combi / quarterTargets.combi : null,
      actual: m.hasData ? toDate.combi : null,
      target: quarterTargets.combi,
    },
    collected: m.hasData ? collected : null,
    catchUp: m.catchUp.combi,
    projection: isMonth ? null : m.projection.attainment,
    telltales,
  }
}

export function personReading(
  person: PersonMetrics,
  expectedShare: number,
  isMonth: boolean,
  settings: MetricSettings,
  telltales: TellTale[],
): ClusterReading {
  return build(
    person,
    person.toDate,
    person.actual.combi,
    person.targets.values,
    person.actual.calls,
    expectedShare,
    isMonth,
    settings,
    telltales,
  )
}

export function teamReading(
  team: TeamMetrics,
  expectedShare: number,
  isMonth: boolean,
  settings: MetricSettings,
  telltales: TellTale[],
): ClusterReading {
  // The tachometer compares like with like: calls of people with a calls target.
  return build(
    team,
    team.measuredToDate,
    team.totals.combi,
    team.targets,
    team.measuredActual.calls,
    expectedShare,
    isMonth,
    settings,
    telltales,
  )
}
