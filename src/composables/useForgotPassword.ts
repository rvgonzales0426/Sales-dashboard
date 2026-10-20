import { reactive, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAsyncAction } from './useAsyncAction'
import * as rules from './useValidation'

export function useForgotPassword() {
  const auth = useAuthStore()

  const form = reactive({ email: '' })
  const valid = ref(false)
  const sent = ref(false)

  const { loading, error, run } = useAsyncAction(
    async () => {
      await auth.sendPasswordReset(form.email.trim())
      sent.value = true
    },
    { toastOnError: false },
  )

  async function submit() {
    if (!valid.value) return
    await run()
  }

  return { form, valid, loading, error, sent, submit, rules: { email: [rules.email] } }
}
