<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const { queue } = storeToRefs(ui)

/** One at a time; the rest wait their turn. */
const current = computed(() => queue.value[0] ?? null)

const icons = {
  success: 'mdi-check-circle-outline',
  error: 'mdi-alert-circle-outline',
  info: 'mdi-information-outline',
} as const
</script>

<template>
  <v-snackbar
    v-if="current"
    :key="current.id"
    :model-value="true"
    :timeout="current.variant === 'error' ? 7000 : 4500"
    color="surface"
    class="toast"
    @update:model-value="ui.dismiss(current.id)"
  >
    <div class="d-flex align-center ga-3">
      <v-icon :icon="icons[current.variant]" :color="current.variant" size="20" />
      <span class="text-body-2">{{ current.message }}</span>
    </div>

    <template #actions>
      <v-btn
        v-if="current.action"
        variant="text"
        size="small"
        color="primary"
        @click="current.action.handler(); ui.dismiss(current.id)"
      >
        {{ current.action.label }}
      </v-btn>
      <v-btn variant="text" size="small" aria-label="Dismiss" @click="ui.dismiss(current.id)">
        <v-icon icon="mdi-close" size="18" />
      </v-btn>
    </template>
  </v-snackbar>
</template>

<style scoped>
.toast :deep(.v-snackbar__wrapper) {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 14px;
  min-width: 300px;
}
</style>
