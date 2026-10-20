<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import TableSkeleton from '@/components/common/TableSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useAdminStore } from '@/stores/admin'
import { useToast } from '@/composables/useToast'
import { formatDateTime } from '@/lib/format'

/** Who uploaded, restored, merged, or changed a target or setting — newest first. */
const admin = useAdminStore()
const toast = useToast()
const kind = ref<string>('')
const loading = ref(true)
const open = ref<Set<number>>(new Set())

const KINDS = [
  { value: '', title: 'Everything' },
  { value: 'upload', title: 'Uploads and restores' },
  { value: 'target', title: 'Targets' },
  { value: 'person', title: 'People and merges' },
  { value: 'settings', title: 'Settings' },
]

async function load(reset = true) {
  loading.value = reset
  try {
    await admin.fetchAudit({ action: kind.value || undefined, reset })
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not load the audit log.')
  } finally {
    loading.value = false
  }
}

onMounted(() => load())
watch(kind, () => load())

function toggle(id: number) {
  const next = new Set(open.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  open.value = next
}
</script>

<template>
  <div class="audit">
    <v-select v-model="kind" :items="KINDS" label="Show" density="compact" class="audit__filter" hide-details />
    <section class="surface-panel">
      <TableSkeleton v-if="loading && !admin.audit.length" :rows="6" :columns="3" />
      <EmptyState v-else-if="!admin.audit.length" icon="mdi-text-box-search-outline" title="Nothing recorded yet" description="Uploads, restores, merges and target edits appear here as they happen." />
      <ol v-else class="audit__list">
        <li v-for="entry in admin.audit" :key="entry.id" class="audit__item">
          <div class="audit__row">
            <time class="audit__time" :datetime="entry.at">{{ formatDateTime(entry.at) }}</time>
            <span class="audit__summary">{{ entry.summary }}</span>
            <span class="audit__who">{{ entry.actor_email ?? 'system' }}</span>
            <v-btn variant="text" size="small" :aria-expanded="open.has(entry.id)" @click="toggle(entry.id)">
              {{ open.has(entry.id) ? 'Hide' : 'Details' }}
            </v-btn>
          </div>
          <pre v-if="open.has(entry.id)" class="audit__details">{{ JSON.stringify(entry.details, null, 2) }}</pre>
        </li>
      </ol>
      <div v-if="admin.auditHasMore" class="audit__more">
        <v-btn variant="outlined" size="small" @click="load(false)">Load older</v-btn>
      </div>
    </section>
  </div>
</template>

<style scoped>
.audit {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}

.audit__filter {
  max-width: 260px;
}

.audit__list {
  list-style: none;
}

.audit__item {
  border-bottom: 1px solid rgb(var(--v-theme-line));
}

.audit__row {
  display: grid;
  grid-template-columns: 170px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  font-size: 0.875rem;
}

.audit__time,
.audit__who {
  color: rgb(var(--v-theme-ink-2));
  font-size: 0.8125rem;
}

.audit__details {
  margin: 0 16px 12px;
  padding: 12px;
  max-height: 320px;
  overflow: auto;
  font-size: 0.75rem;
  border: 1px solid rgb(var(--v-theme-line));
  border-radius: 4px;
  background-color: rgb(var(--v-theme-surface-alt));
}

.audit__more {
  padding: 12px 16px;
}

@media (max-width: 760px) {
  .audit__row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .audit__time,
  .audit__who {
    grid-column: 1;
  }
}

/* Wide tables scroll inside their own frame, never the page. */
.audit > * {
  min-width: 0;
}
</style>
