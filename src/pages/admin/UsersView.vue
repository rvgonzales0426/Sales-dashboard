<script setup lang="ts">
import PageHeader from '@/components/common/PageHeader.vue'
import UserList from '@/components/users/UserList.vue'
</script>

<template>
  <PageHeader
    title="Users"
    description="Who can sign in, and what they are allowed to do once they are in."
  />

  <UserList />
</template>
