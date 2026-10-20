<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import TeamCockpit from '@/components/cockpit/TeamCockpit.vue'
import CockpitEmpty from '@/components/cockpit/CockpitEmpty.vue'
import { usePermissions } from '@/composables/usePermissions'
import { PERMISSIONS } from '@/config/permissions'
import { useSalesStore } from '@/stores/sales'

const { can } = usePermissions()
const router = useRouter()
const sales = useSalesStore()
const ready = ref(can(PERMISSIONS.SalesRead))

// Agents (own numbers only) land on their own cockpit.
onMounted(async () => {
  if (ready.value || !can(PERMISSIONS.SalesSelf)) return
  const mine = await sales.myPersonId().catch(() => null)
  if (mine) router.replace({ path: `/agents/${mine}` })
})
</script>

<template>
  <TeamCockpit v-if="ready" />
  <CockpitEmpty v-else kind="no-access" />
</template>
