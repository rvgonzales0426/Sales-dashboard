<script setup lang="ts">
import AgentCockpit from '@/components/cockpit/AgentCockpit.vue'

defineProps<{ personId: string }>()
</script>

<template>
  <AgentCockpit :person-id="personId" />
</template>
