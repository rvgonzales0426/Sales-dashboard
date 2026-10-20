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
defineProps<{ label: string }>()
</script>

<template>
  <section class="bezel" :aria-label="label">
    <div class="bezel__left"><slot name="left" /></div>
    <div class="bezel__hero"><slot name="hero" /></div>
    <div class="bezel__right"><slot name="right" /></div>
    <div class="bezel__strip">
      <div class="bezel__cell"><slot name="odometer" /></div>
      <div class="bezel__cell"><slot name="range" /></div>
      <div class="bezel__cell bezel__cell--lamps"><slot name="telltales" /></div>
    </div>
  </section>
</template>

<style scoped>
.bezel {
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
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
