<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    /** Say what will happen, in one sentence. */
    message: string
    confirmLabel?: string
    /** Use for anything the user cannot undo. */
    destructive?: boolean
    loading?: boolean
  }>(),
  { confirmLabel: 'Confirm', destructive: false, loading: false },
)

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ confirm: [] }>()
</script>

<template>
  <v-dialog v-model="open" max-width="440">
    <v-card class="rounded-overlay">
      <v-card-title>{{ title }}</v-card-title>
      <v-card-text class="text-body-2 text-medium-emphasis pt-0">{{ message }}</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="loading" @click="open = false">Cancel</v-btn>
        <v-btn
          :color="destructive ? 'error' : 'primary'"
          :loading="loading"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
