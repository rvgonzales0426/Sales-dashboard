<script setup lang="ts">
import StatCard from '@/components/common/StatCard.vue'
import type { DashboardStat } from '@/composables/useDashboard'

defineProps<{ stats: DashboardStat[]; loading?: boolean }>()

/** Shown while loading so the grid keeps its shape. */
const placeholders = [1, 2, 3, 4]
</script>

<template>
  <!-- One panel divided by hairlines, not four identical floating cards.
       The numbers belong to the same measurement, so they share a container. -->
  <div class="surface-panel stats">
    <template v-if="loading">
      <StatCard v-for="n in placeholders" :key="n" label="Loading" value="" loading class="stats__cell" />
    </template>
    <template v-else>
      <StatCard
        v-for="stat in stats"
        :key="stat.key"
        :label="stat.label"
        :value="stat.value"
        :delta="stat.delta"
        :delta-label="stat.deltaLabel"
        :up-is-good="stat.upIsGood"
        class="stats__cell"
      />
    </template>
  </div>
</template>

<style scoped>
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
}

.stats__cell + .stats__cell {
  border-left: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

@media (max-width: 960px) {
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .stats__cell:nth-child(odd) {
    border-left: none;
  }

  .stats__cell:nth-child(n + 3) {
    border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  }
}

@media (max-width: 600px) {
  .stats {
    grid-template-columns: 1fr;
  }

  .stats__cell + .stats__cell {
    border-left: none;
    border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  }
}
</style>
