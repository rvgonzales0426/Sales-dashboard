<script setup lang="ts">
import { useTemplateDownload } from '@/composables/useTemplateDownload'

const { busy, quarter, year, rosterSource, download } = useTemplateDownload()
</script>

<template>
  <v-menu location="bottom end">
    <template #activator="{ props }">
      <v-btn v-bind="props" variant="outlined" prepend-icon="mdi-file-download-outline" :loading="busy">
        Download template
      </v-btn>
    </template>
    <v-list class="rounded-overlay" min-width="300">
      <v-list-item
        title="Blank template"
        :subtitle="`Q${quarter} ${year} layout, no people`"
        @click="download(false)"
      />
      <v-list-item
        :disabled="!rosterSource"
        title="With the current roster"
        :subtitle="rosterSource ? `People and targets from Q${rosterSource.quarter} ${rosterSource.year}` : 'Available after the first upload'"
        @click="download(true)"
      />
    </v-list>
  </v-menu>
</template>
