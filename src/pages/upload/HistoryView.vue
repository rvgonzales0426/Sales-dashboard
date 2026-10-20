<script setup lang="ts">
import PageHeader from '@/components/common/PageHeader.vue'
import UploadHistory from '@/components/upload/UploadHistory.vue'
</script>

<template>
  <PageHeader
    title="Upload history"
    description="Every version of every quarter. The current one feeds the cockpit; any other can be restored."
  >
    <template #actions>
      <v-btn color="primary" to="/upload" prepend-icon="mdi-tray-arrow-up">Upload workbook</v-btn>
    </template>
  </PageHeader>

  <UploadHistory />
</template>
