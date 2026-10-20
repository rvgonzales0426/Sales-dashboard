import { reactive, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAsyncAction } from './useAsyncAction'
import * as rules from './useValidation'

/** Settings > Security. Changing the password of the signed-in user. */
export function useSecurityForm() {
  const auth = useAuthStore()

  const form = reactive({ password: '', confirm: '' })
  const showPassword = ref(false)
  const valid = ref(false)

  const { loading, error, run } = useAsyncAction(
    async () => {
      await auth.updatePassword(form.password)
      form.password = ''
      form.confirm = ''
    },
    { successMessage: 'Password changed.' },
  )

  async function submit() {
    if (!valid.value) return
    await run()
  }

  return {
    form,
    valid,
    showPassword,
    saving: loading,
    error,
    submit,
    rules: {
      password: rules.password,
      confirm: [rules.required('Confirmation'), rules.matches(() => form.password)],
    },
  }
}
