import type { Area, Position, QuarterMonth } from '@/types/sales'
import { formatCount, formatPeso, type Centavos } from '@/lib/metrics/money'
import { displayName, nameKeySimilarity, SUGGESTION_THRESHOLD } from './names'
import { MONTH_NAMES } from './headers'
import type { ParsedPerson, ParsedTargets, TargetField } from './types'

/* ---------------------------------------------------------------------------
 * DIFF — what this upload changes compared with the current version of the
 * same quarter, so nobody overwrites a quarter blind.
 *
 * People are matched by person, not by row: a name the system already knows
 * (directly or through an alias) is that person. A name it has never seen is
 * NEW — and if it looks like someone known ("Pinuella" vs "Piñuela") the diff
 * offers "same person as…?" instead of quietly creating a duplicate.
 * ------------------------------------------------------------------------- */

export interface SnapshotMonth {
  inhouse: Centavos
  ethical: Centavos
  calls: number
}

/** One person as stored in the quarter's current version. */
export interface SnapshotPerson {
  personId: string
  lastName: string
  firstName: string
  position: Position
  area: Area
  months: Partial<Record<QuarterMonth, SnapshotMonth>>
  targets: ParsedTargets
}

/** Everyone the system knows, for matching names to people. */
export interface KnownPerson {
  id: string
  nameKey: string
  lastName: string
  firstName: string
  aliases: string[]
}

export type DiffKind = 'new' | 'added' | 'known' | 'changed' | 'unchanged' | 'removed'

export interface FieldChange {
  label: string
  before: string
  after: string
}

export interface Suggestion {
  personId: string
  name: string
  score: number
}

export interface DiffEntry {
  kind: DiffKind
  nameKey: string
  name: string
  personId: string | null
  sourceRow: number | null
  changes: FieldChange[]
  suggestions: Suggestion[]
}

export interface UploadDiff {
  hasPrevious: boolean
  entries: DiffEntry[]
  counts: Record<DiffKind, number>
}

const POSITION_LABEL: Record<Position, string> = { psr: 'PSR', supervisor: 'Supervisor', group_head: 'Group head' }
const AREA_LABEL: Record<Area, string> = { north: 'North', south: 'South', caraga: 'Caraga', na: 'N/A' }

const money = (value: Centavos | null | undefined) => (value === null || value === undefined ? 'none' : formatPeso(value))
const count = (value: number | null | undefined) => (value === null || value === undefined ? 'none' : formatCount(value))

function compare(person: ParsedPerson, previous: SnapshotPerson, calendarMonths: number[]): FieldChange[] {
  const changes: FieldChange[] = []
  if (person.position && person.position !== previous.position) {
    changes.push({ label: 'Position', before: POSITION_LABEL[previous.position], after: POSITION_LABEL[person.position] })
  }
  if (person.area && person.area !== previous.area) {
    changes.push({ label: 'Area', before: AREA_LABEL[previous.area], after: AREA_LABEL[person.area] })
  }

  for (const month of [1, 2, 3] as QuarterMonth[]) {
    const now = person.months[month - 1]
    const was = previous.months[month]
    const name = MONTH_NAMES[calendarMonths[month - 1] - 1] ?? `Month ${month}`
    const nowData = now.hasData ? now : null
    if (!nowData && !was) continue
    if ((nowData?.inhouse ?? 0) !== (was?.inhouse ?? 0)) {
      changes.push({ label: `${name} in-house`, before: money(was?.inhouse ?? null), after: money(nowData?.inhouse ?? null) })
    }
    if ((nowData?.ethical ?? 0) !== (was?.ethical ?? 0)) {
      changes.push({ label: `${name} ethical`, before: money(was?.ethical ?? null), after: money(nowData?.ethical ?? null) })
    }
    if ((nowData?.calls ?? 0) !== (was?.calls ?? 0)) {
      changes.push({ label: `${name} calls`, before: count(was?.calls ?? null), after: count(nowData?.calls ?? null) })
    }
  }

  const targetLabel: Record<TargetField, string> = {
    inhouse: 'In-house target',
    ethical: 'Ethical target',
    combi: 'Combi target',
    calls: 'Calls target',
  }
  for (const field of ['inhouse', 'ethical', 'combi', 'calls'] as TargetField[]) {
    const before = previous.targets[field]
    const after = person.targets[field]
    if (before === after) continue
    const format = field === 'calls' ? count : money
    changes.push({ label: targetLabel[field], before: format(before), after: format(after) })
  }
  return changes
}

/**
 * @param matches  name_key → person id chosen in the preview ("same person as…")
 */
export function diffUpload(
  parsed: ParsedPerson[],
  previous: SnapshotPerson[] | null,
  known: KnownPerson[],
  calendarMonths: number[],
  matches: Record<string, string> = {},
): UploadDiff {
  const byKey = new Map<string, KnownPerson>()
  for (const person of known) {
    byKey.set(person.nameKey, person)
    for (const alias of person.aliases) byKey.set(alias, person)
  }
  const knownById = new Map(known.map((person) => [person.id, person]))
  const previousById = new Map((previous ?? []).map((person) => [person.personId, person]))

  const resolve = (key: string): KnownPerson | null => {
    const chosen = matches[key]
    if (chosen && knownById.has(chosen)) return knownById.get(chosen)!
    return byKey.get(key) ?? null
  }

  const entries: DiffEntry[] = []
  const present = new Set<string>()

  for (const person of parsed) {
    const name = displayName(person.lastName, person.firstName)
    const match = resolve(person.nameKey)
    const base = { nameKey: person.nameKey, name, sourceRow: person.sourceRow, suggestions: [] as Suggestion[] }

    if (!match) {
      const taken = new Set(parsed.map((p) => resolve(p.nameKey)?.id).filter(Boolean))
      const suggestions = known
        .filter((candidate) => !taken.has(candidate.id))
        .map((candidate) => ({
          personId: candidate.id,
          name: displayName(candidate.lastName, candidate.firstName),
          score: Math.max(nameKeySimilarity(person.nameKey, candidate.nameKey), ...candidate.aliases.map((a) => nameKeySimilarity(person.nameKey, a))),
        }))
        .filter((s) => s.score >= SUGGESTION_THRESHOLD)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
      entries.push({ ...base, kind: 'new', personId: null, changes: [], suggestions })
      continue
    }

    present.add(match.id)
    const was = previousById.get(match.id)
    if (!previous) {
      entries.push({ ...base, kind: 'known', personId: match.id, changes: [] })
    } else if (!was) {
      entries.push({ ...base, kind: 'added', personId: match.id, changes: [] })
    } else {
      const changes = compare(person, was, calendarMonths)
      // A respelling the preview matched is itself a change worth showing.
      if (person.nameKey !== match.nameKey && !match.aliases.includes(person.nameKey)) {
        changes.unshift({ label: 'Name', before: displayName(was.lastName, was.firstName), after: name })
      }
      entries.push({ ...base, kind: changes.length ? 'changed' : 'unchanged', personId: match.id, changes })
    }
  }

  for (const was of previous ?? []) {
    if (present.has(was.personId)) continue
    entries.push({
      kind: 'removed',
      nameKey: '',
      name: displayName(was.lastName, was.firstName),
      personId: was.personId,
      sourceRow: null,
      changes: [],
      suggestions: [],
    })
  }

  const counts: Record<DiffKind, number> = { new: 0, added: 0, known: 0, changed: 0, unchanged: 0, removed: 0 }
  for (const entry of entries) counts[entry.kind]++

  return { hasPrevious: previous !== null, entries, counts }
}
