<script setup lang="ts">
import { computed } from 'vue'
import { MONTH_NAMES, type Issue, type ParsedPerson, type ParseResult } from '@/lib/excel'
import { formatPeso, formatCount } from '@/lib/metrics/money'
import CellFlag from './CellFlag.vue'

const props = defineProps<{ result: ParseResult }>()

const POSITION: Record<string, string> = { psr: 'PSR', supervisor: 'Supervisor', group_head: 'Group head' }
const AREA: Record<string, string> = { north: 'North', south: 'South', caraga: 'Caraga', na: 'N/A' }

const months = computed(() =>
  (props.result.calendarMonths ?? []).map((calendar, index) => ({
    month: (index + 1) as 1 | 2 | 3,
    name: MONTH_NAMES[calendar - 1],
    hasData: props.result.monthsWithData.includes((index + 1) as 1 | 2 | 3),
  })),
)

/** Issues by cell address, so each table cell can flag itself. */
const byCell = computed(() => {
  const map = new Map<string, Issue[]>()
  for (const issue of props.result.issues) {
    if (!issue.cell || !issue.row) continue
    map.set(issue.cell, [...(map.get(issue.cell) ?? []), issue])
  }
  return map
})

/** Row-level notes that belong to no single cell ("No targets for …"). */
const byRow = computed(() => {
  const map = new Map<number, Issue[]>()
  for (const issue of props.result.issues) {
    if (issue.cell || !issue.row || issue.severity === 'info') continue
    map.set(issue.row, [...(map.get(issue.row) ?? []), issue])
  }
  return map
})

function flag(person: ParsedPerson, key: string) {
  const ref = person.cells[key]
  const issues = ref ? byCell.value.get(ref) : undefined
  if (!issues?.length) return null
  const severity = issues.some((i) => i.severity === 'error') ? 'error' : 'warning'
  return { severity: severity as 'error' | 'warning', ref, text: issues.map((i) => i.message).join(' ') }
}

const money = (value: number) => formatPeso(value)
const cellClass = (f: ReturnType<typeof flag>) => (f ? `cell--${f.severity}` : '')
</script>

<template>
  <div class="table-wrap" tabindex="0" role="region" aria-label="Rows read from the workbook" data-testid="preview-table">
    <table class="preview">
      <thead>
        <tr>
          <th rowspan="2" scope="col">Row</th>
          <th rowspan="2" scope="col" class="sticky">Name</th>
          <th rowspan="2" scope="col">Position</th>
          <th rowspan="2" scope="col">Area</th>
          <th v-for="m in months" :key="m.month" colspan="4" scope="colgroup" class="group" :class="{ 'is-empty': !m.hasData }">
            {{ m.name }}<span v-if="!m.hasData" class="group__note"> · no data yet</span>
          </th>
          <th colspan="4" scope="colgroup" class="group">Quarter targets</th>
        </tr>
        <tr>
          <template v-for="m in months" :key="`h-${m.month}`">
            <th scope="col" class="num">In-house</th>
            <th scope="col" class="num">Ethical</th>
            <th scope="col" class="num derived" title="Recomputed as in-house + ethical">Combi</th>
            <th scope="col" class="num">Calls</th>
          </template>
          <th scope="col" class="num">In-house</th>
          <th scope="col" class="num">Ethical</th>
          <th scope="col" class="num">Combi</th>
          <th scope="col" class="num">Calls</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="person in result.people" :key="person.sourceRow" :data-row="person.sourceRow">
          <td class="num muted">{{ person.sourceRow }}</td>
          <th scope="row" class="sticky name" :class="cellClass(flag(person, 'name'))">
            <CellFlag :flag="flag(person, 'name')" />
            <span>{{ person.lastName || '—' }}, {{ person.firstName || '—' }}</span>
            <span v-for="issue in byRow.get(person.sourceRow) ?? []" :key="issue.code" class="row-note" :class="`is-${issue.severity}`">
              {{ issue.code === 'no_targets' ? 'No targets' : issue.code === 'partial_targets' ? 'Some targets missing' : 'Check row' }}
            </span>
          </th>
          <td :class="cellClass(flag(person, 'position'))">
            <CellFlag :flag="flag(person, 'position')" />{{ person.position ? POSITION[person.position] : person.rawPosition || '—' }}
          </td>
          <td :class="cellClass(flag(person, 'area'))">
            <CellFlag :flag="flag(person, 'area')" />{{ person.area ? AREA[person.area] : person.rawArea || '—' }}
          </td>
          <template v-for="m in months" :key="`c-${m.month}`">
            <template v-if="m.hasData">
              <td v-for="field in ['inhouse', 'ethical'] as const" :key="field" class="num" :class="cellClass(flag(person, `${field}:${m.month}`))">
                <CellFlag :flag="flag(person, `${field}:${m.month}`)" />
                {{ money(person.months[m.month - 1][field]) }}
              </td>
              <td class="num derived">{{ money(person.months[m.month - 1].inhouse + person.months[m.month - 1].ethical) }}</td>
              <td class="num" :class="cellClass(flag(person, `calls:${m.month}`))">
                <CellFlag :flag="flag(person, `calls:${m.month}`)" />{{ formatCount(person.months[m.month - 1].calls) }}
              </td>
            </template>
            <td v-else colspan="4" class="no-data">—</td>
          </template>
          <td class="num" :class="cellClass(flag(person, 'target_inhouse'))"><CellFlag :flag="flag(person, 'target_inhouse')" />{{ person.targets.inhouse === null ? '—' : money(person.targets.inhouse) }}</td>
          <td class="num" :class="cellClass(flag(person, 'target_ethical'))"><CellFlag :flag="flag(person, 'target_ethical')" />{{ person.targets.ethical === null ? '—' : money(person.targets.ethical) }}</td>
          <td class="num" :class="cellClass(flag(person, 'target_combi'))"><CellFlag :flag="flag(person, 'target_combi')" />{{ person.targets.combi === null ? '—' : money(person.targets.combi) }}</td>
          <td class="num" :class="cellClass(flag(person, 'target_calls'))"><CellFlag :flag="flag(person, 'target_calls')" />{{ person.targets.calls === null ? '—' : formatCount(person.targets.calls) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
/* The page never scrolls sideways; this table may, inside its own frame. */
.table-wrap {
  /* Contains absolutely positioned screen-reader labels, which would otherwise widen the page. */
  position: relative;
  overflow-x: auto;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  background-color: rgb(var(--v-theme-surface));
}

.preview {
  border-collapse: separate;
  border-spacing: 0;
  width: 100%;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
}

th,
td {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  white-space: nowrap;
  text-align: left;
}

thead th {
  font-family: var(--font-label);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-text-secondary));
  background-color: rgb(var(--v-theme-surface-alt));
}

thead .group {
  text-align: center;
  border-left: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.group.is-empty,
.group__note {
  color: rgb(var(--v-theme-text-secondary));
  font-weight: 400;
}

.num {
  text-align: right;
}

.muted,
.derived {
  color: rgb(var(--v-theme-text-secondary));
}

.no-data {
  text-align: center;
  color: rgb(var(--v-theme-text-secondary));
  border-left: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.sticky {
  position: sticky;
  left: 0;
  z-index: 1;
  background-color: rgb(var(--v-theme-surface));
}

thead .sticky {
  background-color: rgb(var(--v-theme-surface-alt));
}

.name {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}

.row-note {
  font-family: var(--font-label);
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid currentColor;
}

.row-note.is-warning {
  color: rgb(var(--v-theme-caution-ink));
}

.row-note.is-error {
  color: rgb(var(--v-theme-critical));
}

/* A flagged cell: an inset rule in the status colour plus an icon — never colour alone. */
.cell--error {
  box-shadow: inset 0 -2px 0 rgb(var(--v-theme-critical));
}

.cell--warning {
  box-shadow: inset 0 -2px 0 rgb(var(--v-theme-caution));
}


tbody tr:last-child th,
tbody tr:last-child td {
  border-bottom: none;
}
</style>
