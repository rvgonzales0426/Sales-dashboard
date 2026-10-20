<script setup lang="ts">
import { usePermissions } from '@/composables/usePermissions'
import { PERMISSIONS } from '@/config/permissions'

/** Designed empty states: say what's missing and what to do about it. */
defineProps<{ kind: 'no-upload' | 'no-access' | 'no-match' | 'error'; quarter?: string; message?: string }>()
defineEmits<{ reset: [] }>()

const { can } = usePermissions()
</script>

<template>
  <section class="empty" :data-empty="kind">
    <svg class="empty__dial" viewBox="-106 -106 212 212" aria-hidden="true">
      <circle r="100" class="face" />
      <path d="M-63 63 A 89 89 0 1 1 63 63" class="track" />
      <polygon points="-3,10 -60,57 -57,60 3,-10" class="needle" />
      <circle r="8" class="hub" />
    </svg>
    <template v-if="kind === 'no-upload'">
      <h2>No upload for {{ quarter ?? 'this quarter' }} yet.</h2>
      <p>Upload a workbook to light up the cluster.</p>
      <v-btn v-if="can(PERMISSIONS.UploadsWrite)" color="primary" to="/upload" prepend-icon="mdi-tray-arrow-up">Upload a workbook</v-btn>
      <p v-else class="empty__note">An admin uploads the quarter's workbook; it shows here as soon as it's saved.</p>
    </template>
    <template v-else-if="kind === 'no-access'">
      <h2>Your account can’t see sales numbers yet.</h2>
      <p>Ask an admin to give you the Manager role, or turn on agent access and link your account to your name.</p>
    </template>
    <template v-else-if="kind === 'no-match'">
      <h2>No one matches these filters.</h2>
      <p>Widen the areas or roles, or clear the search.</p>
      <v-btn variant="outlined" @click="$emit('reset')">Reset filters</v-btn>
    </template>
    <template v-else>
      <h2>The cockpit couldn’t load.</h2>
      <p>{{ message }}</p>
    </template>
  </section>
</template>

<style scoped>
.empty {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 56px 24px;
  text-align: center;
  border: 1px solid rgb(var(--v-theme-line-strong));
  border-radius: 16px;
  background-color: rgb(var(--v-theme-surface));
}

.empty__dial {
  width: 120px;
  margin-bottom: 8px;
}

.empty__dial .face {
  fill: rgb(var(--v-theme-dial-face));
  stroke: rgb(var(--v-theme-line-strong));
  stroke-width: 2;
}

.empty__dial .track {
  fill: none;
  stroke: rgb(var(--v-theme-track));
  stroke-width: 4;
}

.empty__dial .needle {
  fill: rgb(var(--v-theme-ink-3));
}

.empty__dial .hub {
  fill: rgb(var(--v-theme-surface));
  stroke: rgb(var(--v-theme-line-strong));
  stroke-width: 2;
}

h2 {
  font-size: 1.25rem;
  font-weight: 600;
}

p {
  max-width: 52ch;
  color: rgb(var(--v-theme-ink-2));
}

.v-btn {
  margin-top: 12px;
}

.empty__note {
  margin-top: 8px;
  font-size: 0.875rem;
}
</style>
