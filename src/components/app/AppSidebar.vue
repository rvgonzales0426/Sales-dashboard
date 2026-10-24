<script setup lang="ts">
import { computed } from 'vue'
import { navigation } from '@/config/navigation'
import { useAuthStore } from '@/stores/auth'
import BrandMark from './BrandMark.vue'

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
    color="sidebar"
    class="sidebar"
    elevation="0"
  >
    <div class="sidebar__brand">
      <BrandMark :size="30" />
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
/* The rail is the console: piano black in Day, graphite at Night. It separates
   by tone, not by a shadow. */
.sidebar {
  border-right: 1px solid rgb(var(--v-theme-sidebar-raised)) !important;
  color: rgb(var(--v-theme-on-sidebar));
}

.sidebar__brand {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 56px;
  padding-inline: 18px;
  border-bottom: 1px solid rgb(var(--v-theme-sidebar-raised));
  overflow: hidden;
}

/* Tracked capitals, as on a dashboard's printed legend. */
.sidebar__name {
  font-family: var(--font-label);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  white-space: nowrap;
  color: rgb(var(--v-theme-on-sidebar));
}

.sidebar__nav {
  padding-block: 12px;
}

.sidebar__section {
  padding: 18px 20px 6px;
  font-family: var(--font-label);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-sidebar-ink-2));
}

.sidebar__item {
  margin-bottom: 2px;
  font-size: 0.875rem;
  color: rgb(var(--v-theme-sidebar-ink-2)) !important;
  border-left: 2px solid transparent;
  border-radius: 0 4px 4px 0 !important;
}

.sidebar__item :deep(.v-list-item-title) {
  font-weight: 500;
  letter-spacing: 0.01em;
}

.sidebar__item:hover {
  color: rgb(var(--v-theme-on-sidebar)) !important;
}

/* Active: a fine accent rule and a raised tone — never a filled pill. */
.sidebar__item.v-list-item--active {
  background-color: rgb(var(--v-theme-sidebar-raised));
  color: rgb(var(--v-theme-on-sidebar)) !important;
  border-left-color: rgb(var(--v-theme-sidebar-accent));
}

.sidebar__item.v-list-item--active :deep(.v-icon) {
  color: rgb(var(--v-theme-sidebar-accent));
}

.sidebar__item :deep(.v-list-item__overlay) {
  background-color: rgb(var(--v-theme-on-sidebar));
}

.sidebar :deep(*:focus-visible) {
  outline-color: rgb(var(--v-theme-sidebar-accent));
}
</style>
