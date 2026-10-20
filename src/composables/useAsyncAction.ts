import { ref } from 'vue'
import { useToast } from './useToast'

interface Options {
  /** Shown as a success toast when the action resolves. */
  successMessage?: string
  /** Prefix for the error toast; the thrown message is appended verbatim. */
  fallbackError?: string
  /** Set false to keep the error inline only (forms usually want this). */
  toastOnError?: boolean
}

/**
 * The submit-button pattern used by every form and dialog in the template:
 * a loading flag, a single inline error string, and consistent toasts.
 */
export function useAsyncAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options: Options = {},
) {
  const { successMessage, fallbackError = 'Something went wrong.', toastOnError = true } = options

  const loading = ref(false)
  const error = ref<string | null>(null)
  const toast = useToast()

  async function run(...args: TArgs): Promise<TResult | undefined> {
    loading.value = true
    error.value = null
    try {
      const result = await action(...args)
      if (successMessage) toast.success(successMessage)
      return result
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : fallbackError
      error.value = message
      if (toastOnError) toast.error(message)
      return undefined
    } finally {
      loading.value = false
    }
  }

  return { loading, error, run, reset: () => (error.value = null) }
}
