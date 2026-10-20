<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  /** Sentence case, no trailing colon. */
  label: string
  value: string | number
  /** Signed change, e.g. +12.4%. Omit when there is nothing to compare against. */
  delta?: string
  /** Names the comparison period, e.g. "vs last month". */
  deltaLabel?: string
  /** false when a rise is bad (error rate, cost). Defaults to true. */
  upIsGood?: boolean
  loading?: boolean
}>()

const direction = computed(() => {
  if (!props.delta) return 'flat'
  if (props.delta.startsWith('-')) return 'down'
  if (props.delta.startsWith('+')) return 'up'
  return 'flat'
})

const deltaColor = computed(() => {
  if (direction.value === 'flat') return 'text-secondary'
  const good = props.upIsGood === false ? direction.value === 'down' : direction.value === 'up'
  return good ? 'success' : 'error'
})
</script>

<template>
  <div class="stat">
    <div class="stat__label">{{ label }}</div>

    <template v-if="loading">
      <v-skeleton-loader type="text" class="stat__skeleton" />
    </template>
    <template v-else>
      <!-- Proportional figures: tabular-nums makes a display-size number look loose. -->
      <div class="stat__value">{{ value }}</div>
      <div v-if="delta" class="stat__delta">
        <v-icon
          v-if="direction !== 'flat'"
          :icon="direction === 'up' ? 'mdi-arrow-top-right' : 'mdi-arrow-bottom-right'"
          :color="deltaColor"
          size="14"
        />
        <span :class="`text-${deltaColor}`">{{ delta }}</span>
        <span v-if="deltaLabel" class="stat__period">{{ deltaLabel }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.stat {
  padding: 18px 20px;
  min-width: 0;
}

.stat__label {
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-text-secondary));
}

.stat__value {
  margin-top: 6px;
  font-size: 1.625rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.stat__delta {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
}

.stat__period {
  color: rgb(var(--v-theme-text-secondary));
  font-weight: 400;
}

.stat__skeleton {
  margin-top: 10px;
  max-width: 90px;
  background: transparent;
}
</style>
