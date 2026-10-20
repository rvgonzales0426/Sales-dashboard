<script setup lang="ts">
import PageHeader from '@/components/common/PageHeader.vue'
import TargetsEditor from '@/components/admin/TargetsEditor.vue'
</script>

<template>
  <PageHeader title="Targets" description="Every quarter's targets, from data rather than formulas. Each figure shows where it comes from." />
  <TargetsEditor />
</template>
