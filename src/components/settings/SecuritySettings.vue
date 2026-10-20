<script setup lang="ts">
import SectionCard from '@/components/common/SectionCard.vue'
import FormError from '@/components/common/FormError.vue'
import { useSecurityForm } from '@/composables/useSecurityForm'

const { form, valid, showPassword, saving, error, submit, rules } = useSecurityForm()
</script>

<template>
  <SectionCard
    title="Password"
    description="Changing your password does not sign you out of this device."
  >
    <v-form v-model="valid" @submit.prevent="submit">
      <div class="d-flex flex-column ga-4" style="max-width: 460px">
        <v-text-field
          v-model="form.password"
          label="New password"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="new-password"
          hint="At least 8 characters."
          persistent-hint
          :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
          :rules="rules.password"
          :disabled="saving"
          @click:append-inner="showPassword = !showPassword"
        />

        <v-text-field
          v-model="form.confirm"
          label="Confirm new password"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="new-password"
          :rules="rules.confirm"
          :disabled="saving"
        />

        <FormError :message="error" />
      </div>
    </v-form>

    <template #footer>
      <div class="d-flex justify-end">
        <v-btn color="primary" :loading="saving" :disabled="!valid" @click="submit">
          Change password
        </v-btn>
      </div>
    </template>
  </SectionCard>
</template>
