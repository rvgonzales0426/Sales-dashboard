<script setup lang="ts">
import { computed, ref } from 'vue'
import AreaTag from '@/components/cockpit/AreaTag.vue'
import StatusPill from '@/components/instruments/StatusPill.vue'
import { formatCount, formatPercent, formatPeso, formatPesoCompact, selectTop, type PersonMetrics, type Ranked } from '@/lib/metrics'
import { leaderboardCsv, leaderboardPdf, toRows } from '@/lib/export/leaderboard'
import { saveFile } from '@/lib/download'
import { ROLE_LABEL, type CockpitFilters } from '@/lib/cockpit/filters'
import { useToast } from '@/composables/useToast'

/**
 * The filtered set as a sortable table with inline bars. Top / bottom N cut
 * the rows (ties at the cut are kept); "All" shows everyone, unranked last.
 * Exports carry exactly what is on screen.
 */
const props = defineProps<{
  ranked: Ranked<PersonMetrics>[]
  filters: CockpitFilters
  query: Record<string, string>
  summary: string
  fileStem: string
}>()

type Column = 'rank' | 'name' | 'area' | 'combi' | 'inhouse' | 'ethical' | 'calls' | 'combi_pct'
const sortBy = ref<Column>('rank')
const descending = ref(false)
const toast = useToast()
const exporting = ref(false)

const visible = computed(() => {
  if (props.filters.top === 'all') return props.ranked
  return selectTop(props.ranked, props.filters.top, props.filters.dir)
})

const valueOf = (r: Ranked<PersonMetrics>, column: Column): number | string => {
  switch (column) {
    case 'rank':
      return r.rank ?? Number.POSITIVE_INFINITY
    case 'name':
      return `${r.item.lastName} ${r.item.firstName}`
    case 'area':
      return r.item.area
    case 'combi_pct':
      return r.item.attainment.combi ?? Number.NEGATIVE_INFINITY
    case 'calls':
      return r.item.actual.calls
    default:
      return r.item.actual[column]
  }
}

const rows = computed(() => {
  // Ranking direction applies to the default (rank) sort; columns sort as asked.
  const base = sortBy.value === 'rank' && props.filters.dir === 'bottom' ? [...visible.value].reverse() : visible.value
  if (sortBy.value === 'rank') return descending.value ? [...base].reverse() : base
  return [...base].sort((a, b) => {
    const x = valueOf(a, sortBy.value)
    const y = valueOf(b, sortBy.value)
    const order = typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number)
    return descending.value ? -order : order
  })
})

function sort(column: Column) {
  if (sortBy.value === column) descending.value = !descending.value
  else {
    sortBy.value = column
    descending.value = !['rank', 'name', 'area'].includes(column)
  }
}

const ariaSort = (column: Column) => (sortBy.value !== column ? 'none' : descending.value ? 'descending' : 'ascending')

const combiMax = computed(() => Math.max(...visible.value.map((r) => r.item.actual.combi), 1))
const bar = (value: number) => `${Math.max(0, (value / combiMax.value) * 100)}%`

async function exportCsv() {
  saveFile(leaderboardCsv(toRows(rows.value)), `${props.fileStem}.csv`, 'text/csv;charset=utf-8')
}

async function exportPdf() {
  exporting.value = true
  try {
    const generated = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
    const pdf = await leaderboardPdf(toRows(rows.value), 'Sales leaderboard', `${props.summary} · generated ${generated}`)
    saveFile(pdf, `${props.fileStem}.pdf`, 'application/pdf')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not build the PDF.')
  } finally {
    exporting.value = false
  }
}

const COLUMNS: { key: Column; label: string; numeric?: boolean }[] = [
  { key: 'rank', label: 'Rank', numeric: true },
  { key: 'name', label: 'Name' },
  { key: 'area', label: 'Area' },
  { key: 'combi', label: 'Combi', numeric: true },
  { key: 'inhouse', label: 'In-house', numeric: true },
  { key: 'ethical', label: 'Ethical', numeric: true },
  { key: 'calls', label: 'Calls', numeric: true },
  { key: 'combi_pct', label: 'Combi %', numeric: true },
]
</script>

<template>
  <section class="board" data-testid="leaderboard">
    <div class="board__bar">
      <p class="board__count">{{ rows.length }} {{ rows.length === 1 ? 'person' : 'people' }}</p>
      <div class="board__actions">
        <v-btn variant="outlined" size="small" prepend-icon="mdi-file-delimited-outline" data-testid="export-csv" @click="exportCsv">CSV</v-btn>
        <v-btn variant="outlined" size="small" prepend-icon="mdi-file-pdf-box" :loading="exporting" data-testid="export-pdf" @click="exportPdf">PDF</v-btn>
      </div>
    </div>

    <div class="board__scroll" tabindex="0" role="region" aria-label="Leaderboard">
      <table class="board__table">
        <thead>
          <tr>
            <th v-for="col in COLUMNS" :key="col.key" scope="col" :aria-sort="ariaSort(col.key)" :class="{ num: col.numeric }">
              <button type="button" class="board__sort" @click="sort(col.key)">
                {{ col.label }}
                <v-icon v-if="sortBy === col.key" :icon="descending ? 'mdi-arrow-down' : 'mdi-arrow-up'" size="14" />
              </button>
            </th>
            <th scope="col">Pace</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.item.personId" :data-person="row.item.lastName">
            <td class="num">
              <span class="board__rank" :class="{ 'is-badge': row.rank !== null && filters.top !== 'all' }">{{ row.rank ?? '—' }}</span>
            </td>
            <th scope="row" class="board__name">
              <router-link :to="{ path: `/agents/${row.item.personId}`, query }">{{ row.item.lastName }}, {{ row.item.firstName }}</router-link>
              <span class="board__role">{{ ROLE_LABEL[row.item.position] }}</span>
            </th>
            <td><AreaTag :area="row.item.area" /></td>
            <td class="num board__combi" :title="formatPeso(row.item.actual.combi)">
              <span class="board__spark" aria-hidden="true"><span :style="{ width: bar(row.item.actual.combi) }" /></span>
              {{ formatPesoCompact(row.item.actual.combi) }}
            </td>
            <td class="num" :title="formatPeso(row.item.actual.inhouse)">{{ formatPesoCompact(row.item.actual.inhouse) }}</td>
            <td class="num" :title="formatPeso(row.item.actual.ethical)">{{ formatPesoCompact(row.item.actual.ethical) }}</td>
            <td class="num">{{ formatCount(row.item.actual.calls) }}</td>
            <td class="num">{{ formatPercent(row.item.attainment.combi) }}</td>
            <td><StatusPill :status="row.item.pace.status" size="sm" /></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.board {
  border: 1px solid rgb(var(--v-theme-line));
  border-radius: 6px;
  background-color: rgb(var(--v-theme-surface));
}

.board__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgb(var(--v-theme-line));
}

.board__count {
  font-size: 0.875rem;
  color: rgb(var(--v-theme-ink-2));
}

.board__actions {
  display: flex;
  gap: 8px;
}

.board__scroll {
  /* Contains absolutely positioned screen-reader labels, which would otherwise widen the page. */
  position: relative;
  overflow-x: auto;
}

.board__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

th,
td {
  padding: 10px 16px;
  text-align: left;
  white-space: nowrap;
  border-bottom: 1px solid rgb(var(--v-theme-line));
}

tbody tr:last-child > * {
  border-bottom: none;
}

thead th {
  background-color: rgb(var(--v-theme-surface-alt));
}

.board__sort {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-label);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-ink-2));
}

th:not(.num) .board__sort {
  justify-content: flex-start;
}

thead th:last-child {
  font-family: var(--font-label);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-ink-2));
}

.num {
  text-align: right;
}

.board__rank {
  display: inline-grid;
  place-items: center;
  min-width: 26px;
  height: 24px;
  font-weight: 600;
  color: rgb(var(--v-theme-ink-2));
}

.board__rank.is-badge {
  border-radius: 3px;
  background-color: rgb(var(--v-theme-ink));
  color: rgb(var(--v-theme-surface));
}

.board__name {
  font-weight: 500;
}

.board__name a {
  color: rgb(var(--v-theme-ink));
  text-decoration: none;
}

.board__name a:hover {
  text-decoration: underline;
}

.board__role {
  margin-left: 8px;
  font-size: 0.75rem;
  font-weight: 400;
  color: rgb(var(--v-theme-ink-2));
}

.board__combi {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  font-weight: 600;
}

.board__spark {
  display: inline-block;
  width: 72px;
  height: 6px;
  background-color: rgb(var(--v-theme-track));
}

.board__spark span {
  display: block;
  height: 100%;
  background-color: rgb(var(--v-theme-ink-2));
}
</style>
