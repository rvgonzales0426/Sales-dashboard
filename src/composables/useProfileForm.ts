import { computed, reactive, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAsyncAction } from './useAsyncAction'
import * as rules from './useValidation'

/** Settings > Profile. Edits the signed-in user's own row. */
export function useProfileForm() {
  const auth = useAuthStore()

  const form = reactive({ fullName: '', avatarUrl: '' })

  watch(
    () => auth.profile,
    (profile) => {
      form.fullName = profile?.full_name ?? ''
      form.avatarUrl = profile?.avatar_url ?? ''
    },
    { immediate: true },
  )

  const dirty = computed(
    () =>
      form.fullName !== (auth.profile?.full_name ?? '') ||
      form.avatarUrl !== (auth.profile?.avatar_url ?? ''),
  )

  const { loading, error, run } = useAsyncAction(
    async () => {
      await auth.updateProfile({
        full_name: form.fullName.trim() || null,
        avatar_url: form.avatarUrl.trim() || null,
      })
    },
    { successMessage: 'Profile saved.' },
  )

  function reset() {
    form.fullName = auth.profile?.full_name ?? ''
    form.avatarUrl = auth.profile?.avatar_url ?? ''
  }

  return {
    form,
    dirty,
    saving: loading,
    error,
    save: run,
    reset,
    email: computed(() => auth.profile?.email ?? ''),
    rules: { fullName: [rules.required('Your name'), rules.maxLength(80, 'Your name')] },
  }
}
