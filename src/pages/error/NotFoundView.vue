<script setup lang="ts">
import MessagePage from '@/components/common/MessagePage.vue'
</script>

<template>
  <MessagePage
    code="404"
    title="That page does not exist"
    description="The link may be out of date, or the page may have been renamed. The dashboard is a good place to start again."
  >
    <template #actions>
      <v-btn to="/" color="primary">Go to dashboard</v-btn>
    </template>
  </MessagePage>
</template>
