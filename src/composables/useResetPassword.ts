import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAsyncAction } from './useAsyncAction'
import * as rules from './useValidation'

export function useResetPassword() {
  const auth = useAuthStore()
  const router = useRouter()

  const form = reactive({ password: '', confirm: '' })
  const showPassword = ref(false)
  const valid = ref(false)

  /**
   * Supabase puts a recovery session in place when the emailed link is opened.
   * No session means the link expired or was already used.
   */
  const hasRecoverySession = computed(() => Boolean(auth.session))

  const { loading, error, run } = useAsyncAction(
    async () => {
      await auth.updatePassword(form.password)
      await router.replace({ name: 'dashboard' })
    },
    { successMessage: 'Password updated.', toastOnError: false },
  )

  async function submit() {
    if (!valid.value) return
    await run()
  }

  return {
    form,
    valid,
    showPassword,
    loading,
    error,
    hasRecoverySession,
    submit,
    rules: {
      password: rules.password,
      confirm: [rules.required('Confirmation'), rules.matches(() => form.password)],
    },
  }
}
