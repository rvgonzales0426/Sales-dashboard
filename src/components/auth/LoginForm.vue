<script setup lang="ts">
import AuthHeading from './AuthHeading.vue'
import FormError from '@/components/common/FormError.vue'
import { useLoginForm } from '@/composables/useLoginForm'

const { form, valid, showPassword, loading, error, submit, rules } = useLoginForm()
</script>

<template>
  <AuthHeading title="Sign in" description="Use the email address your account was created with." />

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

      <div>
        <v-text-field
          v-model="form.password"
          label="Password"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="current-password"
          :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
          :rules="rules.password"
          :disabled="loading"
          @click:append-inner="showPassword = !showPassword"
        />
        <div class="d-flex justify-end mt-2">
          <router-link to="/forgot-password" class="link-inline text-caption">
            Forgot your password?
          </router-link>
        </div>
      </div>

      <FormError :message="error" />

      <v-btn type="submit" color="primary" block :loading="loading" :disabled="!valid">
        Sign in
      </v-btn>
    </div>
  </v-form>

  <p class="text-body-2 text-center mt-6 mb-0 text-medium-emphasis">
    New here?
    <router-link to="/register" class="link-inline">Create an account</router-link>
  </p>
</template>
