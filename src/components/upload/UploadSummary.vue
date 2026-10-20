<script setup lang="ts">
import { computed } from 'vue'
import { MONTH_NAMES, type ParseResult } from '@/lib/excel'
import { formatBytes, formatDateTime } from '@/lib/format'
import type { Upload } from '@/types'

const props = defineProps<{
  result: ParseResult
  previous: Upload | null
  loadingPrevious: boolean
}>()

const year = defineModel<number>('year', { required: true })

const monthNames = computed(() => (props.result.calendarMonths ?? []).map((m) => MONTH_NAMES[m - 1]))

const months = computed(() =>
  monthNames.value.map((name, index) => ({
    name,
    hasData: props.result.monthsWithData.includes((index + 1) as 1 | 2 | 3),
  })),
)

const breakdown = computed(() => {
  const count = (position: string) => props.result.people.filter((p) => p.position === position).length
  return [
    { label: 'PSR', value: count('psr') },
    { label: 'Supervisor', value: count('supervisor') },
    { label: 'Group head', value: count('group_head') },
  ].filter((part) => part.value > 0)
})

const excludedText = computed(() =>
  props.result.excluded.map((row) => `${row.label} row ${row.row}`).join(', '),
)
</script>

<template>
  <dl class="summary" data-testid="upload-summary">
    <div class="summary__item summary__item--period">
      <dt>Period</dt>
      <dd>
        <span class="summary__big">Q{{ result.quarter ?? '?' }}</span>
        <v-text-field
          v-model.number="year"
          type="number"
          label="Year"
          density="compact"
          :min="2000"
          :max="2100"
          class="summary__year"
          data-testid="upload-year"
          hint="The workbook doesn't say; check it."
          persistent-hint
        />
      </dd>
      <dd class="summary__note">
        From “QUARTER ENDING {{ result.quarterLabel ?? '—' }}” and the month headers.
      </dd>
    </div>

    <div class="summary__item">
      <dt>Months</dt>
      <dd>
        <ul class="summary__months">
          <li v-for="month in months" :key="month.name" :class="{ 'is-empty': !month.hasData }">
            <span>{{ month.name }}</span>
            <span class="summary__tag">{{ month.hasData ? 'data' : 'no data yet' }}</span>
          </li>
        </ul>
      </dd>
    </div>

    <div class="summary__item">
      <dt>People found</dt>
      <dd>
        <span class="summary__big" data-testid="upload-people-count">{{ result.people.length }}</span>
      </dd>
      <dd class="summary__note">
        {{ breakdown.map((b) => `${b.value} ${b.label}`).join(' · ') }}
      </dd>
    </div>

    <div class="summary__item">
      <dt>Read from</dt>
      <dd class="summary__file">{{ result.fileName }}</dd>
      <dd class="summary__note">
        Sheet “{{ result.sheetName }}”, header on row {{ result.headerRow }} · {{ formatBytes(result.fileSize) }}
        <template v-if="excludedText"> · skipped {{ excludedText }}</template>
      </dd>
    </div>

    <div class="summary__item summary__item--wide">
      <dt>Saving as</dt>
      <dd v-if="loadingPrevious" class="summary__note">Checking Q{{ result.quarter }} {{ year }}…</dd>
      <dd v-else-if="previous" data-testid="upload-version">
        Version {{ previous.version + 1 }} of Q{{ result.quarter }} {{ year }}. It replaces version
        {{ previous.version }}, uploaded {{ formatDateTime(previous.uploaded_at) }}, which stays in history.
      </dd>
      <dd v-else data-testid="upload-version">The first upload for Q{{ result.quarter }} {{ year }}.</dd>
    </div>
  </dl>
</template>

<style scoped>
.summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  background-color: rgba(var(--v-border-color), var(--v-border-opacity));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  overflow: hidden;
}

.summary__item {
  padding: 16px;
  background-color: rgb(var(--v-theme-surface));
  min-width: 0;
}

.summary__item--wide {
  grid-column: 1 / -1;
}

dt {
  font-family: var(--font-label);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-text-secondary));
}

dd {
  margin-top: 6px;
}

.summary__item--period dd:first-of-type {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.summary__big {
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.summary__year {
  max-width: 120px;
}

.summary__note {
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-text-secondary));
}

.summary__file {
  font-weight: 500;
  overflow-wrap: anywhere;
}

.summary__months {
  list-style: none;
  display: grid;
  gap: 4px;
}

.summary__months li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.875rem;
}

.summary__months li.is-empty {
  color: rgb(var(--v-theme-text-secondary));
}

.summary__tag {
  font-family: var(--font-label);
  font-size: 0.6875rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

@media (max-width: 960px) {
  .summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .summary {
    grid-template-columns: 1fr;
  }
}
</style>
