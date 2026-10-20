<script setup lang="ts">
import AuthHeading from './AuthHeading.vue'
import FormError from '@/components/common/FormError.vue'
import { useRegisterForm } from '@/composables/useRegisterForm'

const { form, valid, showPassword, loading, error, submitted, submit, rules } = useRegisterForm()
</script>

<template>
  <template v-if="submitted">
    <AuthHeading
      title="Confirm your email"
      :description="`We sent a confirmation link to ${form.email}. Open it to finish setting up your account.`"
    />
    <v-btn to="/login" variant="outlined" block>Back to sign in</v-btn>
  </template>

  <template v-else>
    <AuthHeading title="Create your account" description="It takes about a minute." />

    <v-form v-model="valid" @submit.prevent="submit">
      <div class="d-flex flex-column ga-4">
        <v-text-field
          v-model="form.fullName"
          label="Full name"
          autocomplete="name"
          autofocus
          :rules="rules.fullName"
          :disabled="loading"
        />

        <v-text-field
          v-model="form.email"
          label="Email"
          type="email"
          autocomplete="email"
          :rules="rules.email"
          :disabled="loading"
        />

        <v-text-field
          v-model="form.password"
          label="Password"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="new-password"
          hint="At least 8 characters."
          persistent-hint
          :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
          :rules="rules.password"
          :disabled="loading"
          @click:append-inner="showPassword = !showPassword"
        />

        <FormError :message="error" />

        <v-btn type="submit" color="primary" block :loading="loading" :disabled="!valid">
          Create account
        </v-btn>
      </div>
    </v-form>

    <p class="text-body-2 text-center mt-6 mb-0 text-medium-emphasis">
      Already have an account?
      <router-link to="/login" class="link-inline">Sign in</router-link>
    </p>
  </template>
</template>
