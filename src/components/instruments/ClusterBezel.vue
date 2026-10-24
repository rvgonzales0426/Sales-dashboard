<script setup lang="ts">
/**
 * The cluster's one housing. Instruments sit inside a single bezel instead of
 * a card each: one edge, one face, a strict grid.
 *
 *   desktop  [ left pair ][ speedometer ][ tach + fuel ]
 *            [ odometer  ][ range       ][ tell-tales  ]
 *   tablet   speedometer across the top, then two columns
 *   phone    one column, speedometer first
 */
import { computed } from 'vue'
import { useThemeStore } from '@/stores/theme'

defineProps<{ label: string }>()

/**
 * The instruments always read on a black face, Day or Night — the black dash
 * in an ivory cabin. In Day ("Ivory") the housing gets a polished chrome rim
 * and a line of contrast stitching, like the stitched leather around a
 * grand tourer's cluster. Flat: borders and a dashed seam, no shadows.
 */
const theme = useThemeStore()
const luxe = computed(() => !theme.isDark)
</script>

<template>
  <div class="housing" :class="{ 'housing--luxe': luxe }">
  <section class="bezel v-theme--dark" :class="{ 'bezel--luxe': luxe }" :aria-label="label">
    <div class="bezel__left"><slot name="left" /></div>
    <div class="bezel__hero"><slot name="hero" /></div>
    <div class="bezel__right"><slot name="right" /></div>
    <div class="bezel__strip">
      <div class="bezel__cell"><slot name="odometer" /></div>
      <div class="bezel__cell"><slot name="range" /></div>
      <div class="bezel__cell bezel__cell--lamps"><slot name="telltales" /></div>
    </div>
  </section>
  </div>
</template>

<style scoped>
/* Ivory mode: a polished chrome rim — a light band between two dark hairlines. */
.housing--luxe {
  padding: 3px;
  border: 1px solid rgb(var(--v-theme-chrome-deep));
  border-radius: 20px;
  background-color: rgb(var(--v-theme-chrome));
}

.bezel {
  position: relative;
  color: rgb(var(--v-theme-on-surface));
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr) minmax(0, 1fr);
  grid-template-areas:
    'left hero right'
    'strip strip strip';
  gap: 24px 32px;
  padding: 32px 32px 0;
  border: 1px solid rgb(var(--v-theme-line-strong));
  border-radius: 16px;
  background-color: rgb(var(--v-theme-surface));
}

.bezel--luxe {
  border-color: rgb(var(--v-theme-chrome-deep));
  background-color: rgb(var(--v-theme-dial-face));
}

/* Contrast stitching: an ivory seam just inside the housing's edge. */
.bezel--luxe::before {
  content: '';
  position: absolute;
  inset: 7px;
  border: 1px dashed rgb(var(--v-theme-stitch));
  border-radius: 11px;
  opacity: 0.45;
  pointer-events: none;
}

.bezel__left {
  grid-area: left;
}

.bezel__hero {
  grid-area: hero;
}

.bezel__right {
  grid-area: right;
}

.bezel__left,
.bezel__right {
  display: grid;
  align-content: center;
  gap: 24px;
}

.bezel__hero {
  display: grid;
  align-content: center;
}

.bezel__strip {
  grid-area: strip;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.25fr);
  margin: 0 -32px;
  border-top: 1px solid rgb(var(--v-theme-line));
}

.bezel__cell {
  padding: 20px 32px 24px;
  min-width: 0;
}

.bezel__cell + .bezel__cell {
  border-left: 1px solid rgb(var(--v-theme-line));
}

.bezel__cell--lamps {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
  align-content: start;
}

/* Tablet: speedometer across the top. */
@media (max-width: 1100px) {
  .bezel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-areas:
      'hero hero'
      'left right'
      'strip strip';
    padding: 24px 24px 0;
  }

  .bezel__hero :deep(.dial) {
    max-width: 380px;
  }

  .bezel__strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin: 0 -24px;
  }

  .bezel__cell {
    padding: 16px 24px 20px;
  }

  .bezel__cell--lamps {
    grid-column: 1 / -1;
    border-left: none !important;
    border-top: 1px solid rgb(var(--v-theme-line));
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

/* Phone: one column, speedometer first. */
@media (max-width: 640px) {
  .bezel {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'hero'
      'left'
      'right'
      'strip';
    padding: 16px 16px 0;
    gap: 16px;
    border-radius: 12px;
  }

  .housing--luxe {
    border-radius: 16px;
  }

  .bezel__left,
  .bezel__right {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: 16px;
  }

  .bezel__right > :last-child:nth-child(odd) {
    grid-column: 1 / -1;
  }

  .bezel__strip {
    grid-template-columns: minmax(0, 1fr);
    margin: 0 -16px;
  }

  .bezel__cell {
    padding: 16px;
  }

  .bezel__cell + .bezel__cell {
    border-left: none;
    border-top: 1px solid rgb(var(--v-theme-line));
  }

  .bezel__cell--lamps {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
