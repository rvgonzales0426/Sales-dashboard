<script setup lang="ts">
import PageHeader from '@/components/common/PageHeader.vue'
import TemplateMenu from '@/components/upload/TemplateMenu.vue'
import UploadFlow from '@/components/upload/UploadFlow.vue'
</script>

<template>
  <PageHeader
    title="Upload workbook"
    description="Drop in the quarter's performance workbook. You'll see exactly what it changes before anything is saved."
  >
    <template #actions>
      <TemplateMenu />
      <v-btn variant="text" to="/upload/history" prepend-icon="mdi-history">History</v-btn>
    </template>
  </PageHeader>

  <UploadFlow />
</template>
