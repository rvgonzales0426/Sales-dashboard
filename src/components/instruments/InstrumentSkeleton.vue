<script setup lang="ts">
/**
 * Loading state shaped like the cluster it replaces: dial rings, an odometer
 * window, lamp boxes. Static — the brief allows motion only for a changing
 * value, and "loading" is not one.
 */
</script>

<template>
  <div class="skeleton" aria-busy="true" aria-live="polite" data-testid="cluster-skeleton">
    <span class="sr-only">Loading the cluster</span>
    <div class="skeleton__dials">
      <div class="skeleton__pair">
        <svg viewBox="-106 -106 212 212" class="skeleton__dial"><circle r="100" /><path d="M-86.6 50A100 100 0 1 1 86.6 50" /></svg>
        <svg viewBox="-106 -106 212 212" class="skeleton__dial"><circle r="100" /><path d="M-86.6 50A100 100 0 1 1 86.6 50" /></svg>
      </div>
      <svg viewBox="-106 -106 212 212" class="skeleton__dial skeleton__dial--hero"><circle r="100" /><path d="M-86.6 50A100 100 0 1 1 86.6 50" /></svg>
      <div class="skeleton__pair">
        <svg viewBox="-106 -106 212 212" class="skeleton__dial"><circle r="100" /><path d="M-86.6 50A100 100 0 1 1 86.6 50" /></svg>
        <div class="skeleton__bar" />
      </div>
    </div>
    <div class="skeleton__strip">
      <div class="skeleton__odo"><span v-for="i in 9" :key="i" /></div>
      <div class="skeleton__line" />
      <div class="skeleton__lamps"><span v-for="i in 4" :key="i" /></div>
    </div>
  </div>
</template>

<style scoped>
.skeleton {
  border: 1px solid rgb(var(--v-theme-line-strong));
  border-radius: 16px;
  background-color: rgb(var(--v-theme-surface));
  padding: 32px 32px 0;
}

.skeleton__dials {
  display: grid;
  grid-template-columns: 1fr 1.5fr 1fr;
  gap: 32px;
  align-items: center;
}

.skeleton__pair {
  display: grid;
  gap: 24px;
  justify-items: center;
}

.skeleton__dial {
  width: 100%;
  max-width: 200px;
}

.skeleton__dial--hero {
  max-width: 400px;
  justify-self: center;
}

.skeleton__dial circle {
  fill: rgb(var(--v-theme-dial-face));
  stroke: rgb(var(--v-theme-line));
  stroke-width: 1;
}

.skeleton__dial path {
  fill: none;
  stroke: rgb(var(--v-theme-track));
  stroke-width: 6;
  transform: scale(0.73);
}

.skeleton__bar,
.skeleton__line {
  width: 100%;
  height: 16px;
  border-radius: 2px;
  background-color: rgb(var(--v-theme-track));
}

.skeleton__strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
  margin: 24px -32px 0;
  padding: 24px 32px;
  border-top: 1px solid rgb(var(--v-theme-line));
}

.skeleton__odo {
  display: flex;
  gap: 2px;
}

.skeleton__odo span {
  width: 24px;
  height: 34px;
  background-color: rgb(var(--v-theme-track));
}

.skeleton__lamps {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.skeleton__lamps span {
  width: 32px;
  height: 32px;
  border: 1px solid rgb(var(--v-theme-line));
  border-radius: 4px;
}

@media (max-width: 1100px) {
  .skeleton__dials {
    grid-template-columns: 1fr;
  }

  .skeleton__pair {
    grid-template-columns: repeat(2, 1fr);
  }

  .skeleton__strip {
    grid-template-columns: 1fr;
  }
}
</style>
