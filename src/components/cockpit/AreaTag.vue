<script setup lang="ts">
import { AREA_LABEL } from '@/lib/cockpit/filters'
import type { Area } from '@/types'

/** An area's identity: its colour as a small square, always beside its name. */
defineProps<{ area: Area }>()
</script>

<template>
  <span class="area-tag" :class="`is-${area}`">
    <span class="area-tag__swatch" aria-hidden="true" />
    {{ AREA_LABEL[area] }}
  </span>
</template>

<style scoped>
.area-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-label);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-ink-2));
}

.area-tag__swatch {
  width: 8px;
  height: 8px;
  border-radius: 1px;
  background-color: rgb(var(--v-theme-ink-3));
}

.is-north .area-tag__swatch {
  background-color: rgb(var(--v-theme-area-north));
}

.is-south .area-tag__swatch {
  background-color: rgb(var(--v-theme-area-south));
}

.is-caraga .area-tag__swatch {
  background-color: rgb(var(--v-theme-area-caraga));
}
</style>
