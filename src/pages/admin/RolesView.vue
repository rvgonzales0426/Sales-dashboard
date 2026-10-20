<script setup lang="ts">
import PageHeader from '@/components/common/PageHeader.vue'
import RoleList from '@/components/roles/RoleList.vue'
</script>

<template>
  <PageHeader
    title="Roles"
    description="Define what each kind of account can do. Permissions are enforced in the database, so changing a role here changes what its holders can actually reach."
  />

  <RoleList />
</template>
