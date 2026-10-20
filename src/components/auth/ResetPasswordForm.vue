<script setup lang="ts">
import AuthHeading from './AuthHeading.vue'
import FormError from '@/components/common/FormError.vue'
import { useResetPassword } from '@/composables/useResetPassword'

const { form, valid, showPassword, loading, error, hasRecoverySession, submit, rules } =
  useResetPassword()
</script>

<template>
  <template v-if="!hasRecoverySession">
    <AuthHeading
      title="This link has expired"
      description="Reset links work once and last an hour. Request a new one and it will arrive in a moment."
    />
    <v-btn to="/forgot-password" color="primary" block>Send a new link</v-btn>
  </template>

  <template v-else>
    <AuthHeading title="Choose a new password" description="You will stay signed in afterwards." />

    <v-form v-model="valid" @submit.prevent="submit">
      <div class="d-flex flex-column ga-4">
        <v-text-field
          v-model="form.password"
          label="New password"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="new-password"
          autofocus
          hint="At least 8 characters."
          persistent-hint
          :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
          :rules="rules.password"
          :disabled="loading"
          @click:append-inner="showPassword = !showPassword"
        />

        <v-text-field
          v-model="form.confirm"
          label="Confirm new password"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="new-password"
          :rules="rules.confirm"
          :disabled="loading"
        />

        <FormError :message="error" />

        <v-btn type="submit" color="primary" block :loading="loading" :disabled="!valid">
          Save new password
        </v-btn>
      </div>
    </v-form>
  </template>
</template>
