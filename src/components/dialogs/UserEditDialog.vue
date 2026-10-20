<script setup lang="ts">
import { computed, toRef } from 'vue'
import FormError from '@/components/common/FormError.vue'
import { useUserDetail } from '@/composables/useUserDetail'
import type { Profile } from '@/types'

const props = defineProps<{ user: Profile | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>({ required: true })

const user = toRef(props, 'user')
const { draft, roleOptions, canSave, isSelf, selfEditWarning, saving, error, save } =
  useUserDetail(() => user.value)

const heading = computed(() => props.user?.full_name || props.user?.email || 'User')

async function onSave() {
  await save()
  if (!error.value) {
    emit('saved')
    open.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="480">
    <v-card class="rounded-overlay">
      <v-card-title>Edit access</v-card-title>
      <v-card-subtitle class="text-medium-emphasis">{{ heading }}</v-card-subtitle>

      <v-card-text class="pt-2">
        <div class="d-flex flex-column ga-5">
          <v-select
            v-model="draft.role_id"
            :items="roleOptions"
            item-title="title"
            item-value="value"
            label="Role"
            :disabled="isSelf || saving"
          >
            <template #item="{ props: itemProps, item }">
              <v-list-item v-bind="itemProps" :subtitle="item.raw.subtitle" />
            </template>
          </v-select>

          <div class="d-flex align-start justify-space-between ga-4">
            <div>
              <div class="text-body-2 font-weight-medium">Account active</div>
              <div class="text-caption text-medium-emphasis">
                A deactivated account keeps its data but cannot sign in.
              </div>
            </div>
            <v-switch v-model="draft.is_active" :disabled="isSelf || saving" color="primary" />
          </div>

          <v-alert v-if="selfEditWarning" type="info" variant="tonal" density="compact">
            {{ selfEditWarning }}
          </v-alert>
          <v-alert v-else-if="isSelf" type="info" variant="tonal" density="compact">
            This is your own account, so its role and status are locked here. Ask someone else
            with user management access to make the change.
          </v-alert>

          <FormError :message="error" />
        </div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="saving" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" :loading="saving" :disabled="!canSave" @click="onSave">
          Save changes
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
