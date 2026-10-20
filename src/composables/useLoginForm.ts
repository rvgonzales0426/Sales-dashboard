import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAsyncAction } from './useAsyncAction'
import * as rules from './useValidation'

export function useLoginForm() {
  const auth = useAuthStore()
  const router = useRouter()
  const route = useRoute()

  const form = reactive({ email: '', password: '' })
  const showPassword = ref(false)
  const valid = ref(false)

  const { loading, error, run } = useAsyncAction(
    async () => {
      await auth.signIn(form.email.trim(), form.password)
      // Honour ?redirect= from the guard, so a deep link survives the detour.
      const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
      await router.replace(redirect)
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
    submit,
    rules: {
      email: [rules.email],
      password: [rules.required('Password')],
    },
  }
}
