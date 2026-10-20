<script setup lang="ts">
import SectionCard from '@/components/common/SectionCard.vue'
import { useThemeStore, type ThemeMode } from '@/stores/theme'

const theme = useThemeStore()

const options: { value: ThemeMode; title: string; description: string; icon: string }[] = [
  { value: 'light', title: 'Light', description: 'Warm paper and white surfaces.', icon: 'mdi-weather-sunny' },
  { value: 'dark', title: 'Dark', description: 'Near-black plane, raised surfaces.', icon: 'mdi-weather-night' },
  { value: 'system', title: 'Match my device', description: 'Follows your operating system setting.', icon: 'mdi-monitor' },
]
</script>

<template>
  <SectionCard title="Appearance" description="Your choice is remembered on this device.">
    <div class="themes">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="theme-option"
        :class="{ 'theme-option--active': theme.mode === option.value }"
        :aria-pressed="theme.mode === option.value"
        @click="theme.set(option.value)"
      >
        <div class="theme-option__head">
          <v-icon :icon="option.icon" size="18" />
          <span class="theme-option__title">{{ option.title }}</span>
          <v-icon
            v-if="theme.mode === option.value"
            icon="mdi-check-circle"
            size="16"
            color="primary"
            class="ml-auto"
          />
        </div>
        <p class="theme-option__description">{{ option.description }}</p>
      </button>
    </div>
  </SectionCard>
</template>

<style scoped>
.themes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 700px) {
  .themes {
    grid-template-columns: 1fr;
  }
}

.theme-option {
  text-align: left;
  padding: 14px;
  border-radius: 6px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background-color: rgb(var(--v-theme-surface));
  color: inherit;
}

.theme-option:hover {
  background-color: rgb(var(--v-theme-surface-alt));
}

.theme-option--active {
  border-color: rgb(var(--v-theme-primary));
  background-color: rgb(var(--v-theme-primary-soft));
}

.theme-option__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.theme-option__title {
  font-size: 0.875rem;
  font-weight: 500;
}

.theme-option__description {
  margin-top: 5px;
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-text-secondary));
}
</style>
