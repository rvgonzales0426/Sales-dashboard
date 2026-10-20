import { computed, ref, shallowRef, watch } from 'vue'
import { useSalesStore, periodKey, parsePeriodKey } from '@/stores/sales'
import { useAdminStore } from '@/stores/admin'
import { useToast } from './useToast'
import { manilaToday } from '@/lib/excel/period'
import { resolveTargets, toAdminTargets, type PersonPeriod, type ResolvedTargets } from '@/lib/metrics'
import type { Area, Position, TargetRow, TargetUpsert } from '@/types'

export interface TargetLine {
  person: PersonPeriod
  resolved: ResolvedTargets
  override: TargetRow | null
}

export type TargetEdit =
  | { kind: 'person'; person: PersonPeriod; row: TargetRow | null; inherited: ResolvedTargets }
  | { kind: 'default'; position: Position; area: Area | null; row: TargetRow | null }

/**
 * Targets per quarter, from data. Shows each person's effective target and
 * where every figure comes from, and edits the admin layer: a person's
 * override, or a default for a position (optionally in one area).
 */
export function useTargetsEditor() {
  const sales = useSalesStore()
  const admin = useAdminStore()
  const toast = useToast()

  const today = manilaToday()
  const periodChoice = ref<string | null>(null)
  const rows = shallowRef<TargetRow[]>([])
  const people = shallowRef<PersonPeriod[]>([])
  const loading = ref(false)
  const editing = shallowRef<TargetEdit | null>(null)

  /** Uploaded quarters, plus this quarter so targets can be set before its first upload. */
  const periodOptions = computed(() => {
    const keys = new Set(sales.periods.map((p) => periodKey(p.year, p.quarter)))
    keys.add(periodKey(today.year, today.quarter))
    return [...keys].sort().reverse().map((key) => ({ value: key, title: key.replace('-', ' ') }))
  })

  const selected = computed(() => parsePeriodKey(periodChoice.value ?? periodOptions.value[0]?.value))

  async function load() {
    const period = selected.value
    if (!period) return
    loading.value = true
    try {
      await sales.initialize()
      const [snapshot, targetRows] = await Promise.all([
        sales.loadPeriod(period.year, period.quarter, { force: true }),
        admin.fetchTargets(period.year, period.quarter),
      ])
      rows.value = targetRows
      if (snapshot) {
        people.value = snapshot.people
      } else {
        // No upload yet for this quarter: everyone active, with no workbook targets.
        if (!admin.peopleLoaded) await admin.fetchPeople()
        people.value = admin.people
          .filter((p) => p.active && !p.merged_into)
          .map((p) => ({
            personId: p.id,
            lastName: p.last_name,
            firstName: p.first_name,
            position: p.position,
            area: p.area,
            months: {},
            fileTargets: { inhouse: null, ethical: null, combi: null, calls: null },
          }))
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load targets.')
    } finally {
      loading.value = false
    }
  }

  watch(selected, load, { immediate: true })
  watch(() => sales.revision, () => (editing.value ? null : load()))

  const adminTargets = computed(() => toAdminTargets(rows.value))

  const lines = computed<TargetLine[]>(() =>
    people.value
      .map((person) => ({
        person,
        resolved: resolveTargets(person, adminTargets.value, sales.settings),
        override: rows.value.find((r) => r.scope === 'person' && r.person_id === person.personId) ?? null,
      }))
      .sort((a, b) => a.person.position.localeCompare(b.person.position) || a.person.lastName.localeCompare(b.person.lastName)),
  )

  const defaults = computed(() => rows.value.filter((r) => r.scope !== 'person'))
  const mismatches = computed(() => lines.value.filter((l) => l.resolved.partsMismatch).length)

  function editPerson(line: TargetLine) {
    // What this person would get WITHOUT their override, shown as placeholders.
    const inherited = resolveTargets(line.person, adminTargets.value.filter((t) => !(t.scope === 'person' && t.personId === line.person.personId)), sales.settings)
    editing.value = { kind: 'person', person: line.person, row: line.override, inherited }
  }

  function editDefault(position: Position, area: Area | null, row: TargetRow | null = null) {
    editing.value = { kind: 'default', position, area, row }
  }

  async function save(values: Pick<TargetUpsert, 'inhouse' | 'ethical' | 'combi' | 'calls' | 'note'>) {
    const edit = editing.value
    const period = selected.value
    if (!edit || !period) return
    const base: TargetUpsert = {
      id: edit.row?.id,
      period_year: period.year,
      period_quarter: period.quarter,
      scope: edit.kind === 'person' ? 'person' : edit.area ? 'position_area' : 'position',
      person_id: edit.kind === 'person' ? edit.person.personId : null,
      position: edit.kind === 'default' ? edit.position : null,
      area: edit.kind === 'default' ? edit.area : null,
      ...values,
    }
    try {
      await admin.saveTarget(base)
      toast.success('Target saved. The cockpit has been updated.')
      editing.value = null
      await sales.invalidate()
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the target.')
    }
  }

  async function remove(row: TargetRow) {
    try {
      await admin.removeTarget(row.id)
      toast.success('Target removed; the next source in line applies again.')
      await sales.invalidate()
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove the target.')
    }
  }

  return {
    periodChoice,
    periodOptions,
    selected,
    loading,
    lines,
    defaults,
    mismatches,
    editing,
    editPerson,
    editDefault,
    save,
    remove,
    close: () => (editing.value = null),
  }
}
