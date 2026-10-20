import type { PerformanceRow, Person, QuarterMonth, SalesSettings, TargetRow, Upload, UploadPerson } from '@/types/sales'
import type { ParsedPerson } from '@/lib/excel/types'
import { toCentavos } from './money'
import type { AdminTarget, MetricSettings, PersonPeriod } from './types'

/* ---------------------------------------------------------------------------
 * Database rows → metric inputs. This is the one place PostgREST's numeric
 * JSON numbers become integer centavos.
 * ------------------------------------------------------------------------- */

const cents = (value: number | null | undefined) => (value === null || value === undefined ? null : toCentavos(value))

export function toPersonPeriods(
  uploadPeople: readonly UploadPerson[],
  rows: readonly PerformanceRow[],
  people: ReadonlyMap<string, Pick<Person, 'last_name' | 'first_name'>>,
): PersonPeriod[] {
  const rowsByPerson = new Map<string, PerformanceRow[]>()
  for (const row of rows) {
    const list = rowsByPerson.get(row.person_id) ?? []
    list.push(row)
    rowsByPerson.set(row.person_id, list)
  }

  return uploadPeople.map((up) => {
    const person = people.get(up.person_id)
    const months: PersonPeriod['months'] = {}
    for (const row of rowsByPerson.get(up.person_id) ?? []) {
      months[row.month] = { inhouse: toCentavos(row.inhouse), ethical: toCentavos(row.ethical), calls: row.calls }
    }
    return {
      personId: up.person_id,
      // The person's current name (admins may fix typos); the snapshot keeps the original.
      lastName: person?.last_name ?? up.source_last_name,
      firstName: person?.first_name ?? up.source_first_name,
      // Position and area AS OF this quarter — a later transfer doesn't rewrite history.
      position: up.position,
      area: up.area,
      months,
      fileTargets: {
        inhouse: cents(up.target_inhouse),
        ethical: cents(up.target_ethical),
        combi: cents(up.target_combi),
        calls: up.target_calls,
      },
    }
  })
}

export function toAdminTargets(rows: readonly TargetRow[]): AdminTarget[] {
  return rows.map((row) => ({
    scope: row.scope,
    personId: row.person_id,
    position: row.position,
    area: row.area,
    inhouse: cents(row.inhouse),
    ethical: cents(row.ethical),
    combi: cents(row.combi),
    calls: row.calls,
  }))
}

/**
 * A parsed workbook as metric inputs — what the cockpit WOULD show if this
 * file were committed. Used by tests and the seed generator.
 */
export function fromParsed(people: readonly ParsedPerson[], monthsWithData: readonly QuarterMonth[]): PersonPeriod[] {
  return people
    .filter((p) => p.position && p.area)
    .map((p) => {
      const months: PersonPeriod['months'] = {}
      for (const m of monthsWithData) {
        const data = p.months[m - 1]
        months[m] = { inhouse: data.inhouse, ethical: data.ethical, calls: data.calls }
      }
      return {
        personId: p.nameKey,
        lastName: p.lastName,
        firstName: p.firstName,
        position: p.position!,
        area: p.area!,
        months,
        fileTargets: { ...p.targets },
      }
    })
}

/**
 * Latest wins: the current version of each quarter. The database guarantees
 * one is_current per quarter; this falls back to the highest version if a
 * caller hands over rows without the flag.
 */
export function currentByPeriod(uploads: readonly Upload[]): Upload[] {
  const best = new Map<string, Upload>()
  for (const upload of uploads) {
    const key = `${upload.period_year}-${upload.period_quarter}`
    const held = best.get(key)
    if (!held || (upload.is_current && !held.is_current) || (upload.is_current === held.is_current && upload.version > held.version)) {
      best.set(key, upload)
    }
  }
  return [...best.values()].sort(
    (a, b) => b.period_year - a.period_year || b.period_quarter - a.period_quarter,
  )
}

export function toMetricSettings(settings: SalesSettings): MetricSettings {
  return {
    onPace: Number(settings.on_pace_threshold),
    atRisk: Number(settings.at_risk_threshold),
    callsLow: Number(settings.calls_low_threshold),
    combiFallback: settings.combi_target_fallback,
    fileCallsBasis: settings.file_calls_target_basis,
    rankRequiresTarget: settings.rank_requires_target,
  }
}
