<script setup lang="ts">
import { computed } from 'vue'
import { navigation } from '@/config/navigation'
import { useAuthStore } from '@/stores/auth'

defineProps<{ rail: boolean; temporary: boolean }>()
const drawer = defineModel<boolean>('drawer', { required: true })

const auth = useAuthStore()
const appName = import.meta.env.VITE_APP_NAME || 'Thesis Template'

/** Cosmetic filtering only — the route guard and RLS are the real gates. */
const sections = computed(() =>
  navigation
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.permissions || auth.canAny(item.permissions)),
    }))
    .filter((section) => section.items.length > 0),
)
</script>

<template>
  <v-navigation-drawer
    v-model="drawer"
    :rail="rail"
    :temporary="temporary"
    :width="248"
    :rail-width="68"
    color="surface-alt"
    class="sidebar"
    elevation="0"
  >
    <div class="sidebar__brand">
      <div class="sidebar__mark">{{ appName.charAt(0) }}</div>
      <span v-if="!rail" class="sidebar__name">{{ appName }}</span>
    </div>

    <div class="sidebar__nav">
      <template v-for="(section, index) in sections" :key="section.title ?? index">
        <div v-if="section.title && !rail" class="sidebar__section">{{ section.title }}</div>
        <v-divider v-else-if="section.title && rail" class="my-2 mx-3" />

        <v-list nav density="comfortable" class="px-2 py-0">
          <v-list-item
            v-for="item in section.items"
            :key="item.to"
            :to="item.to"
            :prepend-icon="item.icon"
            :title="rail ? undefined : item.title"
            :aria-label="item.title"
            exact
            class="sidebar__item"
          >
            <v-tooltip v-if="rail" activator="parent" location="end">{{ item.title }}</v-tooltip>
          </v-list-item>
        </v-list>
      </template>
    </div>
  </v-navigation-drawer>
</template>

<style scoped>
/* Border, not elevation — the sidebar sits in the page, it does not float. */
.sidebar {
  border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)) !important;
}

.sidebar__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  padding-inline: 16px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  overflow: hidden;
}

.sidebar__mark {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  background-color: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-weight: 600;
  font-size: 0.8125rem;
}

.sidebar__name {
  font-weight: 600;
  letter-spacing: -0.015em;
  white-space: nowrap;
}

.sidebar__nav {
  padding-block: 12px;
}

/* Sentence case, ordinary size. A tracked-out all-caps eyebrow here is the
   fastest way to make a dashboard look generated. */
.sidebar__section {
  padding: 14px 18px 6px;
  font-size: 0.75rem;
  font-weight: 500;
  color: rgb(var(--v-theme-text-secondary));
}

.sidebar__item {
  margin-bottom: 2px;
  font-size: 0.875rem;
}

.sidebar__item :deep(.v-list-item-title) {
  font-weight: 500;
  letter-spacing: -0.005em;
}

.sidebar__item.v-list-item--active {
  background-color: rgb(var(--v-theme-primary-soft));
  color: rgb(var(--v-theme-primary));
}

.sidebar__item.v-list-item--active :deep(.v-icon) {
  color: rgb(var(--v-theme-primary));
}
</style>
