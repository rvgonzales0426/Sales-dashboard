<script setup lang="ts">
defineProps<{ message?: string | null }>()
</script>

<template>
  <v-expand-transition>
    <div v-if="message" class="form-error" role="alert">
      <v-icon icon="mdi-alert-circle-outline" size="16" />
      <span>{{ message }}</span>
    </div>
  </v-expand-transition>
</template>

<style scoped>
.form-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-error));
  background-color: rgba(var(--v-theme-error), 0.08);
  border: 1px solid rgba(var(--v-theme-error), 0.2);
}
</style>
