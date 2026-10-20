import { reactive, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAsyncAction } from './useAsyncAction'
import * as rules from './useValidation'

export function useRegisterForm() {
  const auth = useAuthStore()

  const form = reactive({ fullName: '', email: '', password: '' })
  const showPassword = ref(false)
  const valid = ref(false)
  /** Swaps the form for a "check your inbox" panel once the email is sent. */
  const submitted = ref(false)

  const { loading, error, run } = useAsyncAction(
    async () => {
      await auth.signUp(form.email.trim(), form.password, form.fullName.trim())
      submitted.value = true
    },
    { toastOnError: false },
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
    submitted,
    submit,
    rules: {
      fullName: [rules.required('Your name'), rules.maxLength(80, 'Your name')],
      email: [rules.email],
      password: rules.password,
    },
  }
}
