<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { roleColor } from '@/config/roles'

const auth = useAuthStore()
const router = useRouter()
const toast = useToast()

async function signOut() {
  try {
    await auth.signOut()
    await router.replace({ name: 'login' })
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not sign you out.')
  }
}
</script>

<template>
  <v-menu location="bottom end" min-width="240">
    <template #activator="{ props }">
      <button v-bind="props" class="user-trigger" aria-label="Account menu">
        <v-avatar size="28">
          <v-img v-if="auth.profile?.avatar_url" :src="auth.profile.avatar_url" alt="" />
          <span v-else class="user-trigger__initials">{{ auth.initials }}</span>
        </v-avatar>
      </button>
    </template>

    <v-card class="rounded-overlay pa-0">
      <div class="user-card__head">
        <div class="text-body-2 font-weight-medium">{{ auth.displayName }}</div>
        <div class="text-caption text-medium-emphasis">{{ auth.profile?.email }}</div>
        <v-chip :color="roleColor(auth.role)" size="x-small" class="mt-2">
          {{ auth.currentRoleLabel }}
        </v-chip>
      </div>

      <v-divider />

      <v-list density="comfortable" class="px-2">
        <v-list-item to="/settings" prepend-icon="mdi-account-outline" title="Settings" />
        <v-list-item prepend-icon="mdi-logout" title="Sign out" @click="signOut" />
      </v-list>
    </v-card>
  </v-menu>
</template>

<style scoped>
.user-trigger {
  display: grid;
  place-items: center;
  padding: 3px;
  border-radius: 999px;
  background: transparent;
  border: 1px solid transparent;
}

.user-trigger:hover {
  border-color: rgba(var(--v-border-color), var(--v-border-opacity));
}

.user-trigger__initials {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
}

.user-card__head {
  padding: 14px 16px 12px;
}
</style>
