<script setup lang="ts">
/**
 * The company mark: the open square, the red triangle, the diagonal band and
 * the red disc, redrawn as SVG so it stays crisp at badge size. The red is the
 * brand's and lives only here — in the interface, red means "critical".
 *
 * It sits on an ivory badge so the black outline reads on the dark sidebar,
 * the way a maker's badge sits on a console.
 */
withDefaults(defineProps<{ size?: number }>(), { size: 30 })
</script>

<template>
  <span class="brand-badge" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg viewBox="0 0 240 240" role="img" aria-label="Company logo">
      <polygon points="40,6 210,6 40,172" fill="#E3150F" />
      <path d="M30 40 V214 H212 V54" fill="none" stroke="#141414" stroke-width="7" stroke-linejoin="miter" />
      <path d="M30 40 H40" fill="none" stroke="#141414" stroke-width="7" />
      <path d="M200 40 L42 198" fill="none" stroke="#141414" stroke-width="7" />
      <path d="M212 54 L54 212" fill="none" stroke="#141414" stroke-width="7" />
      <circle cx="170" cy="178" r="21" fill="#E3150F" stroke="#141414" stroke-width="3" />
    </svg>
  </span>
</template>

<style scoped>
.brand-badge {
  flex: none;
  display: inline-grid;
  place-items: center;
  border-radius: 6px;
  background-color: #fbf8f3;
  border: 1px solid rgba(0, 0, 0, 0.18);
}

.brand-badge svg {
  width: 74%;
  height: 74%;
  display: block;
}
</style>
