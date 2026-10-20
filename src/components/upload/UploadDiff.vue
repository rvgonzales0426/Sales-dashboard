<script setup lang="ts">
import { computed } from 'vue'
import type { DiffEntry, UploadDiff } from '@/lib/excel'
import type { Upload } from '@/types'
import { formatDateTime } from '@/lib/format'

const props = defineProps<{
  diff: UploadDiff
  previous: Upload | null
  matches: Record<string, string>
  periodLabel: string
}>()

const emit = defineEmits<{ match: [nameKey: string, personId: string | null] }>()

const of = (kind: DiffEntry['kind']) => props.diff.entries.filter((e) => e.kind === kind)
const changed = computed(() => of('changed'))
const created = computed(() => of('new'))
const added = computed(() => of('added'))
const removed = computed(() => of('removed'))

function options(entry: DiffEntry) {
  return [
    { title: 'Add as a new person', value: null },
    ...entry.suggestions.map((s) => ({ title: `Same person as ${s.name}`, value: s.personId })),
  ]
}

/** A matched entry keeps its suggestions visible so the choice can be undone. */
const matchedEntries = computed(() =>
  props.diff.entries.filter((e) => e.nameKey in props.matches && e.kind !== 'new'),
)
</script>

<template>
  <section class="diff" data-testid="upload-diff">
    <p class="diff__lead">
      <template v-if="previous">
        Compared with version {{ previous.version }} of {{ periodLabel }}, uploaded {{ formatDateTime(previous.uploaded_at) }}.
      </template>
      <template v-else>First upload for {{ periodLabel }} — nothing to compare against yet.</template>
    </p>

    <ul class="diff__counts" aria-label="Summary of changes">
      <li><strong>{{ diff.counts.changed }}</strong> changed</li>
      <li><strong>{{ diff.counts.new }}</strong> new {{ diff.counts.new === 1 ? 'person' : 'people' }}</li>
      <li v-if="diff.hasPrevious"><strong>{{ diff.counts.added }}</strong> returning</li>
      <li v-if="diff.hasPrevious"><strong>{{ diff.counts.removed }}</strong> removed</li>
      <li v-if="diff.hasPrevious"><strong>{{ diff.counts.unchanged }}</strong> unchanged</li>
    </ul>

    <div v-if="created.length" class="diff__block">
      <h3 class="diff__title">New people</h3>
      <p class="diff__hint">
        These names have never been uploaded before. If one is a respelling of someone already in the system, match it —
        otherwise their history splits in two.
      </p>
      <ul class="diff__list">
        <li v-for="entry in created" :key="entry.nameKey" class="diff__row" :data-name="entry.name">
          <span class="diff__name">{{ entry.name }}</span>
          <span class="diff__meta">row {{ entry.sourceRow }}</span>
          <v-select
            v-if="entry.suggestions.length"
            class="diff__match"
            density="compact"
            :items="options(entry)"
            :model-value="matches[entry.nameKey] ?? null"
            label="Who is this?"
            hide-details
            @update:model-value="(value: string | null) => emit('match', entry.nameKey, value)"
          />
          <span v-else class="diff__meta diff__meta--end">Will be added</span>
        </li>
      </ul>
    </div>

    <div v-if="matchedEntries.length" class="diff__block">
      <h3 class="diff__title">Matched to existing people</h3>
      <ul class="diff__list">
        <li v-for="entry in matchedEntries" :key="entry.nameKey" class="diff__row">
          <span class="diff__name">{{ entry.name }}</span>
          <span class="diff__meta">remembered as a spelling of this person from now on</span>
          <v-btn variant="text" size="small" class="ml-auto" @click="emit('match', entry.nameKey, null)">Undo</v-btn>
        </li>
      </ul>
    </div>

    <div v-if="changed.length" class="diff__block">
      <h3 class="diff__title">Changed values</h3>
      <ul class="diff__list">
        <li v-for="entry in changed" :key="entry.personId ?? entry.nameKey" class="diff__row diff__row--stack">
          <span class="diff__name">{{ entry.name }}</span>
          <ul class="diff__changes">
            <li v-for="change in entry.changes" :key="change.label">
              <span class="diff__field">{{ change.label }}</span>
              <span class="diff__before">{{ change.before }}</span>
              <span aria-hidden="true">→</span>
              <span class="sr-only">changes to</span>
              <span class="diff__after">{{ change.after }}</span>
            </li>
          </ul>
        </li>
      </ul>
    </div>

    <div v-if="diff.hasPrevious && added.length" class="diff__block">
      <h3 class="diff__title">Back in this quarter</h3>
      <ul class="diff__list">
        <li v-for="entry in added" :key="entry.nameKey" class="diff__row">
          <span class="diff__name">{{ entry.name }}</span>
          <span class="diff__meta">not in version {{ previous?.version }}</span>
        </li>
      </ul>
    </div>

    <div v-if="removed.length" class="diff__block">
      <h3 class="diff__title">Removed</h3>
      <p class="diff__hint">In version {{ previous?.version }} but not in this file. They drop out of {{ periodLabel }}; their earlier quarters are kept.</p>
      <ul class="diff__list">
        <li v-for="entry in removed" :key="entry.personId!" class="diff__row">
          <span class="diff__name">{{ entry.name }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.diff {
  display: grid;
  gap: 16px;
}

.diff__lead {
  font-size: 0.875rem;
  color: rgb(var(--v-theme-text-secondary));
}

.diff__counts {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  font-size: 0.875rem;
}

.diff__counts strong {
  font-size: 1.25rem;
  font-weight: 600;
  margin-right: 4px;
  font-variant-numeric: tabular-nums;
}

.diff__block {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding-top: 16px;
}

.diff__title {
  font-family: var(--font-label);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.diff__hint {
  margin-top: 4px;
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-text-secondary));
  max-width: 70ch;
}

.diff__list {
  list-style: none;
  margin-top: 8px;
}

.diff__row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.diff__row--stack {
  align-items: flex-start;
  flex-direction: column;
  gap: 4px;
}

.diff__name {
  font-weight: 500;
  min-width: 180px;
}

.diff__meta {
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-text-secondary));
}

.diff__meta--end {
  margin-left: auto;
}

.diff__match {
  margin-left: auto;
  min-width: 260px;
  max-width: 340px;
}

.diff__changes {
  list-style: none;
  display: grid;
  gap: 2px;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
}

.diff__changes li {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.diff__field {
  min-width: 150px;
  color: rgb(var(--v-theme-text-secondary));
}

.diff__before {
  text-decoration: line-through;
  color: rgb(var(--v-theme-text-secondary));
}

.diff__after {
  font-weight: 600;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
