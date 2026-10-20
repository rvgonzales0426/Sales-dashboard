<script setup lang="ts">
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <div class="auth-heading">
    <h1 class="auth-heading__title">{{ title }}</h1>
    <p v-if="description" class="auth-heading__description">{{ description }}</p>
  </div>
</template>

<style scoped>
.auth-heading {
  margin-bottom: 22px;
}

.auth-heading__title {
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.auth-heading__description {
  margin-top: 5px;
  font-size: 0.875rem;
  color: rgb(var(--v-theme-text-secondary));
}
</style>
