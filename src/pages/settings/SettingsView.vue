<script setup lang="ts">
import { ref } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import ProfileSettings from '@/components/settings/ProfileSettings.vue'
import SecuritySettings from '@/components/settings/SecuritySettings.vue'
import AppearanceSettings from '@/components/settings/AppearanceSettings.vue'

const tab = ref<'profile' | 'security' | 'appearance'>('profile')
</script>

<template>
  <PageHeader title="Settings" description="Your account and how the app looks to you." />

  <v-tabs v-model="tab" class="settings-tabs mb-6">
    <v-tab value="profile">Profile</v-tab>
    <v-tab value="security">Security</v-tab>
    <v-tab value="appearance">Appearance</v-tab>
  </v-tabs>

  <v-window v-model="tab">
    <v-window-item value="profile"><ProfileSettings /></v-window-item>
    <v-window-item value="security"><SecuritySettings /></v-window-item>
    <v-window-item value="appearance"><AppearanceSettings /></v-window-item>
  </v-window>
</template>

<style scoped>
.settings-tabs {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
