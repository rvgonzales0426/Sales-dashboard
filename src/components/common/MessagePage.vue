<script setup lang="ts">
defineProps<{ code: string; title: string; description: string }>()
</script>

<template>
  <v-main class="message-page">
    <div class="message-page__inner">
      <div class="message-page__code">{{ code }}</div>
      <h1 class="message-page__title">{{ title }}</h1>
      <p class="message-page__description">{{ description }}</p>
      <div class="message-page__actions">
        <slot name="actions" />
      </div>
    </div>
  </v-main>
</template>

<style scoped>
.message-page {
  min-height: 100vh;
  background-color: rgb(var(--v-theme-background));
  display: grid;
  place-items: center;
  padding: 24px;
}

.message-page__inner {
  max-width: 420px;
  text-align: center;
}

.message-page__code {
  font-size: 0.8125rem;
  font-weight: 500;
  color: rgb(var(--v-theme-text-secondary));
  margin-bottom: 8px;
}

.message-page__title {
  font-size: 1.375rem;
  font-weight: 600;
  letter-spacing: -0.022em;
}

.message-page__description {
  margin-top: 8px;
  font-size: 0.9375rem;
  color: rgb(var(--v-theme-text-secondary));
}

.message-page__actions {
  margin-top: 22px;
  display: flex;
  gap: 8px;
  justify-content: center;
}
</style>
