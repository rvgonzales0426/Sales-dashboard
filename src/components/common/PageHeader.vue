<script setup lang="ts">
defineProps<{
  title: string
  /** One plain sentence. Say what the page is for, not what it is called. */
  description?: string
}>()
</script>

<template>
  <header class="page-header">
    <div class="page-header__text">
      <h1 class="page-header__title">{{ title }}</h1>
      <p v-if="description" class="page-header__description">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.page-header__title {
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.022em;
  line-height: 1.2;
}

.page-header__description {
  margin-top: 6px;
  max-width: 62ch;
  color: rgb(var(--v-theme-text-secondary));
  font-size: 0.875rem;
}

.page-header__actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
