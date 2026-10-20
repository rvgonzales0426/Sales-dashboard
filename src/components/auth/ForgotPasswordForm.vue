<script setup lang="ts">
import AuthHeading from './AuthHeading.vue'
import FormError from '@/components/common/FormError.vue'
import { useForgotPassword } from '@/composables/useForgotPassword'

const { form, valid, loading, error, sent, submit, rules } = useForgotPassword()
</script>

<template>
  <template v-if="sent">
    <AuthHeading
      title="Check your inbox"
      :description="`If an account exists for ${form.email}, a reset link is on its way. The link works once and expires in an hour.`"
    />
    <v-btn to="/login" variant="outlined" block>Back to sign in</v-btn>
  </template>

  <template v-else>
    <AuthHeading
      title="Reset your password"
      description="Enter your email address and we will send you a link to set a new one."
    />

    <v-form v-model="valid" @submit.prevent="submit">
      <div class="d-flex flex-column ga-4">
        <v-text-field
          v-model="form.email"
          label="Email"
          type="email"
          autocomplete="email"
          autofocus
          :rules="rules.email"
          :disabled="loading"
        />

        <FormError :message="error" />

        <v-btn type="submit" color="primary" block :loading="loading" :disabled="!valid">
          Send reset link
        </v-btn>
        <v-btn to="/login" variant="text" block>Back to sign in</v-btn>
      </div>
    </v-form>
  </template>
</template>
