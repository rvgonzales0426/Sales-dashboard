<script setup lang="ts">
import AppSnackbar from '@/components/app/AppSnackbar.vue'
</script>

<template>
  <v-app>
    <router-view />
    <!-- Mounted once, above every layout, so auth screens get feedback too. -->
    <AppSnackbar />
  </v-app>
</template>
