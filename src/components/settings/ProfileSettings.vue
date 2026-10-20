<script setup lang="ts">
import SectionCard from '@/components/common/SectionCard.vue'
import FormError from '@/components/common/FormError.vue'
import { useProfileForm } from '@/composables/useProfileForm'
import { useAuthStore } from '@/stores/auth'

const { form, dirty, saving, error, save, reset, email, rules } = useProfileForm()
const auth = useAuthStore()
</script>

<template>
  <SectionCard
    title="Profile"
    description="This is what other people in the system see."
  >
    <div class="d-flex align-center ga-4 mb-6">
      <v-avatar size="52">
        <v-img v-if="form.avatarUrl" :src="form.avatarUrl" alt="" />
        <span v-else class="avatar-initials">{{ auth.initials }}</span>
      </v-avatar>
      <div>
        <div class="text-body-2 font-weight-medium">{{ auth.displayName }}</div>
        <div class="text-caption text-medium-emphasis">
          Paste an image URL below to change this.
        </div>
      </div>
    </div>

    <v-form @submit.prevent="save()">
      <div class="d-flex flex-column ga-4" style="max-width: 460px">
        <v-text-field
          v-model="form.fullName"
          label="Full name"
          :rules="rules.fullName"
          :disabled="saving"
        />

        <v-text-field
          v-model="form.avatarUrl"
          label="Avatar image URL"
          placeholder="https://"
          :disabled="saving"
        />

        <v-text-field
          :model-value="email"
          label="Email"
          disabled
          hint="Email changes go through Supabase Auth and are out of scope for this template."
          persistent-hint
        />

        <FormError :message="error" />
      </div>
    </v-form>

    <template #footer>
      <div class="d-flex justify-end ga-2">
        <v-btn variant="text" :disabled="!dirty || saving" @click="reset">Discard</v-btn>
        <v-btn color="primary" :loading="saving" :disabled="!dirty" @click="save()">
          Save changes
        </v-btn>
      </div>
    </template>
  </SectionCard>
</template>

<style scoped>
.avatar-initials {
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
}
</style>
