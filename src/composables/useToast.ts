import { useUiStore } from '@/stores/ui'

/**
 * Sugar over the ui store so components read as `toast.success('Saved.')`.
 * Copy rule: past tense for what happened, plain language, no exclamation marks.
 */
export function useToast() {
  const ui = useUiStore()
  return {
    success: ui.success,
    error: ui.error,
    info: ui.info,
  }
}
