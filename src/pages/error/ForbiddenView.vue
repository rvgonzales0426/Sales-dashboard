<script setup lang="ts">
import MessagePage from '@/components/common/MessagePage.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <MessagePage
    code="403"
    title="You do not have access to that page"
    :description="`Your account has the ${auth.currentRoleLabel} role, which does not include this page. Ask an admin to grant it.`"
  >
    <template #actions>
      <v-btn to="/" color="primary">Go to dashboard</v-btn>
      <v-btn to="/settings" variant="outlined">Open settings</v-btn>
    </template>
  </MessagePage>
</template>
