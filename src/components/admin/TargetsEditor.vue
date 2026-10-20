<script setup lang="ts">
import TableSkeleton from '@/components/common/TableSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import TargetDialog from '@/components/dialogs/TargetDialog.vue'
import AreaTag from '@/components/cockpit/AreaTag.vue'
import { useTargetsEditor, type TargetLine } from '@/composables/useTargetsEditor'
import { useAdminStore } from '@/stores/admin'
import { AREAS, AREA_LABEL, ROLE_LABEL, ROLES } from '@/lib/cockpit/filters'
import { formatCount, formatPeso, type TargetSource } from '@/lib/metrics'
import type { TargetRow } from '@/types'

const editor = useTargetsEditor()
const { periodChoice, periodOptions, selected, loading, lines, defaults, mismatches, editing } = editor
const admin = useAdminStore()

const SOURCE_LABEL: Record<TargetSource, string> = {
  person: 'Override',
  file: 'Workbook',
  position_area: 'Area default',
  position: 'Role default',
  derived: 'Parts sum',
}

const FIELDS = ['inhouse', 'ethical', 'combi', 'calls'] as const

const show = (line: TargetLine, field: (typeof FIELDS)[number]) => {
  const value = line.resolved.values[field]
  if (value === null) return '—'
  return field === 'calls' ? formatCount(value) : formatPeso(value, { whole: true })
}

const peso = (value: number | null) => (value === null ? '—' : formatPeso(Math.round(value * 100), { whole: true }))
const defaultLabel = (row: TargetRow) => `${ROLE_LABEL[row.position!]}${row.area ? ` · ${AREA_LABEL[row.area]}` : ' · every area'}`
</script>

<template>
  <div class="targets">
    <div class="targets__bar">
      <v-select
        v-model="periodChoice"
        :items="periodOptions"
        :placeholder="periodOptions[0]?.title"
        label="Quarter"
        density="compact"
        class="targets__period"
        hide-details
      />
      <p v-if="mismatches" class="targets__warn" role="status">
        <v-icon icon="mdi-alert" size="16" />
        {{ mismatches }} {{ mismatches === 1 ? 'person has' : 'people have' }} a combi target that isn't in-house + ethical. It's used as written.
      </p>
    </div>

    <section class="surface-panel">
      <header class="targets__head">
        <h2 class="micro-label">People · {{ selected ? `Q${selected.quarter} ${selected.year}` : '' }}</h2>
        <span class="targets__hint">Order of precedence: override → workbook → area default → role default.</span>
      </header>
      <TableSkeleton v-if="loading && !lines.length" :rows="6" :columns="6" />
      <EmptyState v-else-if="!lines.length" icon="mdi-account-group-outline" title="No one to set targets for yet" description="People appear here after the first workbook upload." />
      <div v-else class="targets__scroll">
        <table class="targets__table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Role</th>
              <th scope="col">Area</th>
              <th v-for="f in FIELDS" :key="f" scope="col" class="num">{{ f === 'inhouse' ? 'In-house' : f[0].toUpperCase() + f.slice(1) }}</th>
              <th scope="col"><span class="sr-only">Edit</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="line in lines" :key="line.person.personId">
              <th scope="row">{{ line.person.lastName }}, {{ line.person.firstName }}</th>
              <td>{{ ROLE_LABEL[line.person.position] }}</td>
              <td><AreaTag :area="line.person.area" /></td>
              <td v-for="f in FIELDS" :key="f" class="num">
                <span class="targets__value">
                  <v-icon v-if="f === 'combi' && line.resolved.partsMismatch" icon="mdi-alert" size="14" class="targets__icon" title="In-house + ethical ≠ combi" aria-label="Parts don't add up to this combi target" />
                  {{ show(line, f) }}
                </span>
                <span v-if="line.resolved.sources[f]" class="targets__source" :class="{ 'is-override': line.resolved.sources[f] === 'person' }">
                  {{ SOURCE_LABEL[line.resolved.sources[f]!] }}
                </span>
              </td>
              <td class="num">
                <v-btn variant="text" size="small" @click="editor.editPerson(line)">{{ line.override ? 'Edit override' : 'Override' }}</v-btn>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="surface-panel">
      <header class="targets__head">
        <h2 class="micro-label">Defaults</h2>
        <span class="targets__hint">Fill gaps for anyone the workbook leaves without a target.</span>
        <v-menu>
          <template #activator="{ props }">
            <v-btn v-bind="props" variant="outlined" size="small" prepend-icon="mdi-plus" class="ml-auto">Add default</v-btn>
          </template>
          <v-list class="rounded-overlay">
            <template v-for="role in ROLES" :key="role">
              <v-list-item :title="`${ROLE_LABEL[role]} · every area`" @click="editor.editDefault(role, null)" />
              <v-list-item v-for="area in AREAS" :key="`${role}-${area}`" :title="`${ROLE_LABEL[role]} · ${AREA_LABEL[area]}`" @click="editor.editDefault(role, area)" />
            </template>
          </v-list>
        </v-menu>
      </header>
      <p v-if="!defaults.length" class="targets__none">No defaults yet. Supervisors and the group head have no workbook targets; a default here would measure them.</p>
      <table v-else class="targets__table">
        <tbody>
          <tr v-for="row in defaults" :key="row.id">
            <th scope="row">{{ defaultLabel(row) }}</th>
            <td class="num">{{ peso(row.inhouse) }}</td>
            <td class="num">{{ peso(row.ethical) }}</td>
            <td class="num">{{ peso(row.combi) }}</td>
            <td class="num">{{ row.calls === null ? '—' : formatCount(row.calls) }}</td>
            <td class="num">
              <v-btn variant="text" size="small" @click="editor.editDefault(row.position!, row.area, row)">Edit</v-btn>
              <v-btn variant="text" size="small" @click="editor.remove(row)">Remove</v-btn>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <TargetDialog :edit="editing" :saving="admin.busy" @save="editor.save" @close="editor.close" />
  </div>
</template>

<style scoped>
.targets {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}

.targets__bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px 24px;
}

.targets__period {
  max-width: 200px;
}

.targets__warn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  color: rgb(var(--v-theme-caution-ink));
}

.targets__head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 14px 16px;
  border-bottom: 1px solid rgb(var(--v-theme-line));
}

.targets__hint,
.targets__none {
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-ink-2));
}

.targets__none {
  padding: 16px;
}

.targets__scroll {
  /* Contains absolutely positioned screen-reader labels, which would otherwise widen the page. */
  position: relative;
  overflow-x: auto;
}

.targets__table {
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
  vertical-align: top;
}

thead th {
  font-family: var(--font-label);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-ink-2));
}

tbody th {
  font-weight: 500;
}

.num {
  text-align: right;
}

.targets__value {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
}

.targets__icon {
  color: rgb(var(--v-theme-caution-ink));
}

.targets__source {
  display: block;
  font-family: var(--font-label);
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-ink-2));
}

.targets__source.is-override {
  color: rgb(var(--v-theme-ink));
}

/* Wide tables scroll inside their own frame, never the page. */
.targets > * {
  min-width: 0;
}
</style>
