<script setup lang="ts">
import FormError from '@/components/common/FormError.vue'
import { useInviteForm } from '@/composables/useInviteForm'

const open = defineModel<boolean>({ required: true })

const { form, valid, roleOptions, sending, error, submit, rules } = useInviteForm(() => {
  open.value = false
})
</script>

<template>
  <v-dialog v-model="open" max-width="480">
    <v-card class="rounded-overlay">
      <v-card-title>Invite someone</v-card-title>
      <v-card-subtitle class="text-medium-emphasis">
        They get an email with a link to set their own password.
      </v-card-subtitle>

      <v-card-text class="pt-2">
        <v-form v-model="valid" @submit.prevent="submit">
          <div class="d-flex flex-column ga-4">
            <v-text-field
              v-model="form.email"
              label="Email"
              type="email"
              autofocus
              :rules="rules.email"
              :disabled="sending"
            />

            <v-text-field
              v-model="form.fullName"
              label="Full name (optional)"
              :rules="rules.fullName"
              :disabled="sending"
            />

            <v-select
              v-model="form.roleKey"
              :items="roleOptions"
              item-title="title"
              item-value="value"
              label="Role"
              :disabled="sending"
            />

            <FormError :message="error" />
          </div>
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="sending" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" :loading="sending" :disabled="!valid" @click="submit">
          Send invite
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
