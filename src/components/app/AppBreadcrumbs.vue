<script setup lang="ts">
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'

const { crumbs } = useBreadcrumbs()
</script>

<template>
  <nav class="crumbs" aria-label="Breadcrumb">
    <template v-for="(crumb, index) in crumbs" :key="crumb.title">
      <span v-if="index > 0" class="crumbs__sep" aria-hidden="true">/</span>
      <router-link v-if="crumb.to && !crumb.disabled" :to="crumb.to" class="crumbs__link">
        {{ crumb.title }}
      </router-link>
      <span v-else class="crumbs__current" aria-current="page">{{ crumb.title }}</span>
    </template>
  </nav>
</template>

<style scoped>
.crumbs {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  min-width: 0;
}

.crumbs__sep {
  color: rgb(var(--v-theme-text-secondary));
  opacity: 0.5;
}

.crumbs__link {
  color: rgb(var(--v-theme-text-secondary));
  text-decoration: none;
}

.crumbs__link:hover {
  color: rgb(var(--v-theme-on-surface));
}

.crumbs__current {
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
