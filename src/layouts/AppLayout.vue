<script setup lang="ts">
import AppSidebar from '@/components/app/AppSidebar.vue'
import AppBar from '@/components/app/AppBar.vue'
import { useAppShell } from '@/composables/useAppShell'

const { drawer, rail, isMobile, toggleSidebar } = useAppShell()
</script>

<template>
  <AppSidebar v-model:drawer="drawer" :rail="rail && !isMobile" :temporary="isMobile" />
  <AppBar :rail="rail" @toggle-sidebar="toggleSidebar" />

  <v-main class="app-main">
    <div class="app-container">
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </div>
  </v-main>
</template>

<style scoped>
.app-main {
  background-color: rgb(var(--v-theme-background));
  min-height: 100vh;
}

/* One content measure for every page, so pages never set their own gutters. */
.app-container {
  max-width: 1240px;
  margin-inline: auto;
  padding: 32px;
}

@media (max-width: 960px) {
  .app-container {
    padding: 20px 16px 40px;
  }
}
</style>
