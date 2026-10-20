<script setup lang="ts">
import PageHeader from '@/components/common/PageHeader.vue'
import AuditLog from '@/components/admin/AuditLog.vue'
</script>

<template>
  <PageHeader title="Audit log" description="Every upload, restore, merge and target change, and who made it." />
  <AuditLog />
</template>
