<script setup lang="ts">
import PageHeader from '@/components/common/PageHeader.vue'
import SectionCard from '@/components/common/SectionCard.vue'
import DashboardStats from '@/components/dashboard/DashboardStats.vue'
import DashboardChart from '@/components/dashboard/DashboardChart.vue'
import DashboardActivity from '@/components/dashboard/DashboardActivity.vue'
import { useDashboard } from '@/composables/useDashboard'
import { useAuthStore } from '@/stores/auth'

const { loading, stats, series, activity } = useDashboard()
const auth = useAuthStore()
</script>

<template>
  <PageHeader
    :title="`Good to see you, ${auth.displayName.split(' ')[0]}`"
    description="A snapshot of the system. Replace these widgets with the numbers your project actually tracks."
  />

  <DashboardStats :stats="stats" :loading="loading" class="mb-6" />

  <div class="dashboard-grid">
    <SectionCard
      title="Records created"
      description="Placeholder series — swap in a real query from a Pinia store."
    >
      <DashboardChart :points="series" series-label="Records" :loading="loading" />
    </SectionCard>

    <SectionCard title="Recent activity" flush>
      <DashboardActivity :entries="activity" :loading="loading" />
    </SectionCard>
  </div>
</template>

<style scoped>
.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

@media (max-width: 1100px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
</style>
