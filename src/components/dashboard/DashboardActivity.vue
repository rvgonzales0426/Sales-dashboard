<script setup lang="ts">
import EmptyState from '@/components/common/EmptyState.vue'
import type { ActivityEntry } from '@/composables/useDashboard'

defineProps<{ entries: ActivityEntry[]; loading?: boolean }>()
</script>

<template>
  <div v-if="loading" class="activity">
    <div v-for="n in 3" :key="n" class="activity__row">
      <div class="activity__skeleton" style="width: 58%" />
      <div class="activity__skeleton activity__skeleton--dim" style="width: 34%" />
    </div>
  </div>

  <EmptyState
    v-else-if="!entries.length"
    icon="mdi-history"
    title="Nothing has happened yet"
    description="Activity shows up here as soon as someone creates or changes a record."
  />

  <ul v-else class="activity">
    <li v-for="entry in entries" :key="entry.id" class="activity__row">
      <div class="activity__dot" aria-hidden="true" />
      <div class="activity__body">
        <div class="activity__title">{{ entry.title }}</div>
        <div class="activity__detail">{{ entry.detail }}</div>
      </div>
      <time class="activity__time">{{ entry.at }}</time>
    </li>
  </ul>
</template>

<style scoped>
.activity {
  list-style: none;
  padding: 0;
  margin: 0;
}

.activity__row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.activity__row:last-child {
  border-bottom: none;
}

.activity__dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  margin-top: 7px;
  flex: 0 0 auto;
  background-color: rgb(var(--v-chart-1));
}

.activity__body {
  min-width: 0;
  flex: 1;
}

.activity__title {
  font-size: 0.875rem;
  font-weight: 500;
}

.activity__detail {
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-text-secondary));
}

.activity__time {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-text-secondary));
  white-space: nowrap;
  padding-top: 2px;
}

.activity__skeleton {
  height: 10px;
  border-radius: 999px;
  background-color: rgb(var(--v-theme-surface-variant));
  animation: activity-pulse 1.4s ease-in-out infinite;
}

.activity__skeleton--dim {
  opacity: 0.6;
  margin-top: 8px;
}

@keyframes activity-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

@media (prefers-reduced-motion: reduce) {
  .activity__skeleton {
    animation: none;
  }
}
</style>
