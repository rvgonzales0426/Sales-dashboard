<script setup lang="ts">
defineProps<{
  icon?: string
  /** What is missing, in the user's words. */
  title: string
  /** What to do about it. Never "No data available". */
  description: string
}>()
</script>

<template>
  <div class="empty">
    <div v-if="icon" class="empty__icon">
      <v-icon :icon="icon" size="22" />
    </div>
    <h3 class="empty__title">{{ title }}</h3>
    <p class="empty__description">{{ description }}</p>
    <div v-if="$slots.action" class="empty__action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 24px;
}

.empty__icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  margin-bottom: 14px;
  background-color: rgb(var(--v-theme-surface-alt));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  color: rgb(var(--v-theme-text-secondary));
}

.empty__title {
  font-size: 0.9375rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.empty__description {
  margin-top: 5px;
  max-width: 44ch;
  font-size: 0.875rem;
  color: rgb(var(--v-theme-text-secondary));
}

.empty__action {
  margin-top: 18px;
}
</style>
