<script setup lang="ts">
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()
</script>

<template>
  <v-btn
    :icon="theme.isDark ? 'mdi-weather-night' : 'mdi-weather-sunny'"
    variant="text"
    size="small"
    :aria-label="theme.isDark ? 'Switch to light theme' : 'Switch to dark theme'"
    @click="theme.toggle()"
  >
    <v-icon :icon="theme.isDark ? 'mdi-weather-night' : 'mdi-weather-sunny'" size="20" />
    <v-tooltip activator="parent" location="bottom">
      {{ theme.isDark ? 'Light theme' : 'Dark theme' }}
    </v-tooltip>
  </v-btn>
</template>
