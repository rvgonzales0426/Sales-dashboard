<script setup lang="ts">
/** The icon a flagged preview cell wears: shape says severity, the tooltip says why. */
defineProps<{ flag: { severity: 'error' | 'warning'; text: string } | null }>()
</script>

<template>
  <span v-if="flag" class="flag" :class="`is-${flag.severity}`" tabindex="0" :aria-label="flag.text" role="img">
    <v-icon :icon="flag.severity === 'error' ? 'mdi-alert-octagon' : 'mdi-alert'" size="14" />
    <v-tooltip activator="parent" location="top" max-width="320">{{ flag.text }}</v-tooltip>
  </span>
</template>

<style scoped>
.flag {
  display: inline-flex;
  margin-right: 4px;
  vertical-align: -2px;
  border-radius: 2px;
}

.flag.is-error {
  color: rgb(var(--v-theme-critical));
}

.flag.is-warning {
  color: rgb(var(--v-theme-caution-ink));
}
</style>
