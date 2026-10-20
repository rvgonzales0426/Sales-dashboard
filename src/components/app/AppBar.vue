<script setup lang="ts">
import AppBreadcrumbs from './AppBreadcrumbs.vue'
import ThemeToggle from './ThemeToggle.vue'
import UserMenu from './UserMenu.vue'

defineProps<{ rail: boolean }>()
defineEmits<{ 'toggle-sidebar': [] }>()
</script>

<template>
  <v-app-bar :height="56" flat color="surface" class="appbar">
    <v-btn
      variant="text"
      size="small"
      class="ml-2"
      :aria-label="rail ? 'Expand sidebar' : 'Collapse sidebar'"
      @click="$emit('toggle-sidebar')"
    >
      <v-icon icon="mdi-dock-left" size="20" />
    </v-btn>

    <AppBreadcrumbs class="ml-2" />

    <v-spacer />

    <div class="d-flex align-center ga-1 pr-3">
      <ThemeToggle />
      <UserMenu />
    </div>
  </v-app-bar>
</template>

<style scoped>
/* Hairline, no shadow: the bar is part of the page frame, not a floating layer. */
.appbar {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)) !important;
}
</style>
