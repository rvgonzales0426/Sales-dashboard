<script setup lang="ts">
import { computed } from 'vue'
import EmptyState from '@/components/common/EmptyState.vue'
import TableSkeleton from '@/components/common/TableSkeleton.vue'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog.vue'
import { useUploadHistory } from '@/composables/useUploadHistory'
import { usePermissions } from '@/composables/usePermissions'
import { PERMISSIONS } from '@/config/permissions'
import { formatDateTime, quarterLabel } from '@/lib/format'
import type { Upload } from '@/types'

const { groups, loading, loaded, restoring, busy, askRestore, confirmRestore, download } = useUploadHistory()
const { can } = usePermissions()

const restoreOpen = computed({
  get: () => restoring.value !== null,
  set: (open) => {
    if (!open) restoring.value = null
  },
})

const uploader = (upload: Upload) => upload.uploader?.full_name || upload.uploader?.email || 'Seed data'
</script>

<template>
  <div class="history" data-testid="upload-history">
    <div v-if="loading && !loaded" class="surface-panel"><TableSkeleton :rows="4" :columns="6" /></div>

    <div v-else-if="!groups.length" class="surface-panel">
      <EmptyState
        icon="mdi-tray-arrow-up"
        title="No uploads yet"
        description="Upload the quarter's performance workbook and every version will be listed here, restorable."
      >
        <template #action>
          <v-btn color="primary" to="/upload">Upload a workbook</v-btn>
        </template>
      </EmptyState>
    </div>

    <section v-for="group in groups" v-else :key="group.key" class="surface-panel history__period">
      <header class="history__head">
        <h2 class="history__title">{{ group.label }}</h2>
        <span class="history__count">{{ group.versions.length }} {{ group.versions.length === 1 ? 'version' : 'versions' }}</span>
      </header>
      <div class="history__scroll">
        <table class="history__table">
          <thead>
            <tr>
              <th scope="col">Version</th>
              <th scope="col">File</th>
              <th scope="col">Uploaded by</th>
              <th scope="col">When</th>
              <th scope="col" class="num">People</th>
              <th scope="col">Checks</th>
              <th scope="col"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="upload in group.versions" :key="upload.id" :class="{ 'is-current': upload.is_current }">
              <td>
                <span class="history__version">v{{ upload.version }}</span>
                <span v-if="upload.is_current" class="history__current">Current</span>
              </td>
              <td class="history__file">{{ upload.original_filename }}</td>
              <td>{{ uploader(upload) }}</td>
              <td class="nowrap">{{ formatDateTime(upload.uploaded_at) }}</td>
              <td class="num">{{ upload.row_count }}</td>
              <td>
                <span v-if="upload.warning_count" class="history__warn">
                  <v-icon icon="mdi-alert" size="14" /> {{ upload.warning_count }}
                  {{ upload.warning_count === 1 ? 'warning' : 'warnings' }}
                </span>
                <span v-else class="history__clean">Clean</span>
              </td>
              <td class="history__actions">
                <v-btn
                  v-if="upload.file_path"
                  variant="text"
                  size="small"
                  prepend-icon="mdi-download"
                  :aria-label="`Download the original file of version ${upload.version}`"
                  @click="download(upload)"
                >
                  Original
                </v-btn>
                <v-btn
                  v-if="!upload.is_current && can(PERMISSIONS.UploadsWrite)"
                  variant="text"
                  size="small"
                  prepend-icon="mdi-restore"
                  @click="askRestore(upload)"
                >
                  Restore
                </v-btn>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <ConfirmDialog
      v-model="restoreOpen"
      :title="restoring ? `Restore version ${restoring.version}?` : ''"
      :message="restoring ? `The cockpit will show version ${restoring.version} of ${quarterLabel(restoring.period_year, restoring.period_quarter)} again. The version it replaces stays in this list.` : ''"
      confirm-label="Restore"
      :loading="busy"
      @confirm="confirmRestore"
    />
  </div>
</template>

<style scoped>
.history {
  display: grid;
  gap: 16px;
}

.history__head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.history__title {
  font-size: 1rem;
  font-weight: 600;
}

.history__count {
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-text-secondary));
}

.history__scroll {
  overflow-x: auto;
}

.history__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

th,
td {
  padding: 10px 20px;
  text-align: left;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

tbody tr:last-child td {
  border-bottom: none;
}

th {
  font-family: var(--font-label);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-text-secondary));
}

.num {
  text-align: right;
}

.nowrap {
  white-space: nowrap;
}

.history__version {
  font-weight: 600;
}

.history__current {
  margin-left: 8px;
  font-family: var(--font-label);
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 3px;
  background-color: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}

.history__file {
  overflow-wrap: anywhere;
}

.history__warn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: rgb(var(--v-theme-caution-ink));
}

.history__clean {
  color: rgb(var(--v-theme-text-secondary));
}

.history__actions {
  text-align: right;
  white-space: nowrap;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
