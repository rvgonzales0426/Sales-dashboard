<script setup lang="ts">
import { roleColor, roleLabel } from '@/config/roles'
import type { Role } from '@/types'

defineProps<{ role: Role | null | undefined }>()
</script>

<template>
  <v-chip :color="roleColor(role)" size="small" variant="tonal">
    {{ roleLabel(role) }}
  </v-chip>
</template>
