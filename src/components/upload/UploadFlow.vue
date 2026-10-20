<script setup lang="ts">
import { computed } from 'vue'
import UploadDropZone from './UploadDropZone.vue'
import UploadSummary from './UploadSummary.vue'
import IssueList from './IssueList.vue'
import UploadDiff from './UploadDiff.vue'
import PreviewTable from './PreviewTable.vue'
import { useUploadFlow } from '@/composables/useUploadFlow'
import { quarterLabel } from '@/lib/format'

const flow = useUploadFlow()
const { step, result, year, previous, loadingPrevious, diff, blockers, ready, error, committed, matches } = flow

const periodLabel = computed(() => (result.value?.quarter ? quarterLabel(year.value, result.value.quarter) : ''))
const nextVersion = computed(() => (previous.value ? previous.value.upload.version + 1 : 1))
const warningCount = computed(() => result.value?.issues.filter((i) => i.severity === 'warning').length ?? 0)
</script>

<template>
  <div class="flow">
    <!-- 1. Choose -->
    <template v-if="step === 'idle' || step === 'reading'">
      <UploadDropZone :disabled="step === 'reading'" @select="flow.select" />
      <p v-if="step === 'reading'" class="flow__status" role="status">Reading the workbook…</p>
      <v-alert v-if="error" type="error" class="mt-4">{{ error }}</v-alert>
    </template>

    <!-- 2a. Unreadable file -->
    <template v-else-if="step === 'preview' && result?.fatal">
      <section class="surface-panel flow__fatal" role="alert" data-testid="upload-fatal">
        <v-icon icon="mdi-alert-octagon" size="22" class="flow__fatal-icon" />
        <div>
          <h2 class="flow__fatal-title">{{ result.fileName }} can’t be imported</h2>
          <p class="flow__fatal-message">{{ result.fatal.message }}</p>
          <v-btn class="mt-4" color="primary" @click="flow.reset">Choose another file</v-btn>
        </div>
      </section>
    </template>

    <!-- 2b. Preview -->
    <template v-else-if="(step === 'preview' || step === 'committing') && result">
      <UploadSummary
        v-model:year="year"
        :result="result"
        :previous="previous?.upload ?? null"
        :loading-previous="loadingPrevious"
      />

      <IssueList :issues="result.issues" />

      <section v-if="diff" class="surface-panel flow__section">
        <h2 class="flow__heading">What changes</h2>
        <UploadDiff
          :diff="diff"
          :previous="previous?.upload ?? null"
          :matches="matches"
          :period-label="periodLabel"
          @match="flow.match"
        />
      </section>

      <section v-if="result.people.length" class="flow__section flow__section--bare">
        <h2 class="flow__heading">Rows read from the workbook</h2>
        <p class="flow__sub">Combi is recomputed from in-house + ethical; the workbook’s own COMBI and totals are ignored.</p>
        <PreviewTable :result="result" />
      </section>

      <div class="flow__bar" data-testid="upload-actions">
        <div class="flow__bar-text">
          <template v-if="blockers.length">
            <strong>Can’t save yet.</strong> {{ blockers[0] }}
            <span v-if="blockers.length > 1"> (and {{ blockers.length - 1 }} more)</span>
          </template>
          <template v-else>
            Saves version {{ nextVersion }} of {{ periodLabel }}<template v-if="warningCount">
              with {{ warningCount }} {{ warningCount === 1 ? 'warning' : 'warnings' }}</template
            >. The cockpit updates straight away.
          </template>
          <span v-if="error" class="flow__bar-error" role="alert">{{ error }}</span>
        </div>
        <div class="flow__bar-actions">
          <v-btn variant="text" :disabled="step === 'committing'" @click="flow.reset">Cancel</v-btn>
          <v-btn
            color="primary"
            :disabled="!ready"
            :loading="step === 'committing'"
            data-testid="upload-commit"
            @click="flow.commit"
          >
            Save version {{ nextVersion }}
          </v-btn>
        </div>
      </div>
    </template>

    <!-- 3. Done -->
    <section v-else-if="step === 'done' && committed" class="surface-panel flow__done" role="status" data-testid="upload-done">
      <v-icon icon="mdi-check-circle-outline" size="24" class="flow__done-icon" />
      <div>
        <h2 class="flow__done-title">
          Saved version {{ committed.version }} of {{ quarterLabel(committed.period_year, committed.period_quarter) }}
        </h2>
        <p class="flow__sub">
          {{ committed.row_count }} people. The cockpit and any wall displays have been updated.
        </p>
        <div class="flow__done-actions">
          <v-btn color="primary" :to="{ path: '/', query: { pq: `${committed.period_year}-Q${committed.period_quarter}` } }">
            Open the cockpit
          </v-btn>
          <v-btn variant="outlined" to="/upload/history">See history</v-btn>
          <v-btn variant="text" @click="flow.reset">Upload another</v-btn>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.flow {
  display: grid;
  gap: 24px;
}

.flow__status {
  font-size: 0.875rem;
  color: rgb(var(--v-theme-text-secondary));
}

.flow__section {
  padding: 20px;
}

.flow__section--bare {
  padding: 0;
}

.flow__heading {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 12px;
}

.flow__sub {
  margin: -8px 0 12px;
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-text-secondary));
}

.flow__fatal,
.flow__done {
  display: flex;
  gap: 16px;
  padding: 24px;
}

.flow__fatal {
  border-left: 3px solid rgb(var(--v-theme-critical));
}

.flow__fatal-icon {
  color: rgb(var(--v-theme-critical));
}

.flow__fatal-title,
.flow__done-title {
  font-size: 1.0625rem;
  font-weight: 600;
}

.flow__fatal-message {
  margin-top: 6px;
  max-width: 70ch;
}

.flow__done-icon {
  color: rgb(var(--v-theme-good));
}

.flow__done .flow__sub {
  margin: 6px 0 0;
}

.flow__done-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

/* The save bar stays in reach while scrolling a long preview. */
.flow__bar {
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px 24px;
  padding: 14px 20px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  background-color: rgb(var(--v-theme-surface));
}

.flow__bar-text {
  font-size: 0.875rem;
  max-width: 70ch;
}

.flow__bar-error {
  display: block;
  margin-top: 4px;
  color: rgb(var(--v-theme-critical));
}

.flow__bar-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
</style>
