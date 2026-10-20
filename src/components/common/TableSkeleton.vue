<script setup lang="ts">
/**
 * Loading placeholder shaped like the table it replaces. Skeletons over
 * spinners: the page keeps its layout, so nothing jumps when data lands.
 */
withDefaults(defineProps<{ rows?: number; columns?: number }>(), { rows: 5, columns: 4 })
</script>

<template>
  <div class="skeleton" aria-busy="true" aria-live="polite">
    <span class="sr-only">Loading</span>
    <div v-for="row in rows" :key="row" class="skeleton__row">
      <div
        v-for="column in columns"
        :key="column"
        class="skeleton__cell"
        :style="{ width: column === 1 ? '32%' : `${Math.floor(60 / (columns - 1))}%` }"
      />
    </div>
  </div>
</template>

<style scoped>
.skeleton {
  padding: 4px 0;
}

.skeleton__row {
  display: flex;
  gap: 24px;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.skeleton__row:last-child {
  border-bottom: none;
}

.skeleton__cell {
  height: 10px;
  border-radius: 999px;
  background-color: rgb(var(--v-theme-surface-variant));
  animation: skeleton-pulse 1.4s ease-in-out infinite;
}

.skeleton__row:nth-child(even) .skeleton__cell {
  animation-delay: 0.12s;
}

@keyframes skeleton-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton__cell {
    animation: none;
  }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
