<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Issue, Severity } from '@/lib/excel'

const props = defineProps<{ issues: Issue[] }>()

const META: Record<Severity, { label: string; plural: string; icon: string; note: string }> = {
  error: {
    label: 'Error',
    plural: 'errors',
    icon: 'mdi-alert-octagon',
    note: 'Fix these in the workbook and upload it again. They block saving.',
  },
  warning: {
    label: 'Warning',
    plural: 'warnings',
    icon: 'mdi-alert',
    note: 'Saved with the upload. They do not block saving.',
  },
  info: { label: 'Note', plural: 'notes', icon: 'mdi-information-outline', note: 'For your information.' },
}

const groups = computed(() =>
  (['error', 'warning', 'info'] as Severity[])
    .map((severity) => ({ severity, ...META[severity], items: props.issues.filter((i) => i.severity === severity) }))
    .filter((group) => group.items.length > 0),
)

// Notes stay folded unless asked for; errors and warnings are always open.
const showNotes = ref(false)
</script>

<template>
  <div v-if="groups.length" class="issues" data-testid="upload-issues">
    <section v-for="group in groups" :key="group.severity" class="issues__group" :class="`is-${group.severity}`">
      <header class="issues__head">
        <v-icon :icon="group.icon" size="18" class="issues__icon" />
        <h3 class="issues__title">
          {{ group.items.length }} {{ group.items.length === 1 ? group.label.toLowerCase() : group.plural }}
        </h3>
        <span class="issues__note">{{ group.note }}</span>
        <v-btn
          v-if="group.severity === 'info'"
          variant="text"
          size="small"
          class="ml-auto"
          :aria-expanded="showNotes"
          @click="showNotes = !showNotes"
        >
          {{ showNotes ? 'Hide' : 'Show' }}
        </v-btn>
      </header>
      <ul v-if="group.severity !== 'info' || showNotes" class="issues__list">
        <li v-for="(issue, index) in group.items" :key="index" :data-code="issue.code">
          <span class="issues__badge">{{ group.label }}</span>
          <span class="issues__message">{{ issue.message }}</span>
          <span v-if="issue.cell" class="issues__cell">{{ issue.cell }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.issues {
  display: grid;
  gap: 12px;
}

.issues__group {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-left-width: 3px;
  border-radius: 6px;
  background-color: rgb(var(--v-theme-surface));
}

.issues__group.is-error {
  border-left-color: rgb(var(--v-theme-critical));
}

.issues__group.is-warning {
  border-left-color: rgb(var(--v-theme-caution));
}

.issues__head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 10px;
  padding: 12px 16px;
}

.is-error .issues__icon {
  color: rgb(var(--v-theme-critical));
}

.is-warning .issues__icon {
  color: rgb(var(--v-theme-caution));
}

.issues__title {
  font-size: 0.9375rem;
  font-weight: 600;
}

.issues__note {
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-text-secondary));
}

.issues__list {
  list-style: none;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.issues__list li {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 4px 12px;
  align-items: baseline;
  padding: 10px 16px;
  font-size: 0.875rem;
}

.issues__list li + li {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.issues__badge,
.issues__cell {
  font-family: var(--font-label);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-text-secondary));
}

.issues__cell {
  font-variant-numeric: tabular-nums;
  text-transform: none;
}

@media (max-width: 560px) {
  .issues__list li {
    grid-template-columns: 1fr;
  }
}
</style>
