<script setup lang="ts">
import PageHeader from '@/components/common/PageHeader.vue'
import PeopleList from '@/components/admin/PeopleList.vue'
</script>

<template>
  <PageHeader title="People" description="Everyone the uploads have introduced. Fix names, link sign-ins, and merge duplicates." />
  <PeopleList />
</template>
