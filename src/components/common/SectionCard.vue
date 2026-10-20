<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  /** Removes the body padding — for tables that should meet the border. */
  flush?: boolean
}>()
</script>

<template>
  <section class="surface-panel section">
    <div class="section__head">
      <div>
        <h2 class="section__title">{{ title }}</h2>
        <p v-if="description" class="section__description">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="section__actions">
        <slot name="actions" />
      </div>
    </div>

    <div :class="flush ? '' : 'section__body'">
      <slot />
    </div>

    <div v-if="$slots.footer" class="section__footer">
      <slot name="footer" />
    </div>
  </section>
</template>

<style scoped>
.section {
  overflow: hidden;
}

.section__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 18px 20px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.section__title {
  font-size: 0.9375rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.section__description {
  margin-top: 3px;
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-text-secondary));
  max-width: 62ch;
}

.section__actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.section__body {
  padding: 20px;
}

.section__footer {
  padding: 14px 20px;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background-color: rgb(var(--v-theme-surface-alt));
}
</style>
