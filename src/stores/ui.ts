import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Toast } from '@/types'

/**
 * App-wide feedback queue. One toast is shown at a time; the rest wait.
 * Rendered by components/app/AppSnackbar.vue, mounted once in AppLayout.
 */
export const useUiStore = defineStore('ui', () => {
  const queue = ref<Toast[]>([])
  let nextId = 0

  function push(message: string, variant: Toast['variant'], action?: Toast['action']) {
    queue.value.push({ id: nextId++, message, variant, action })
  }

  function dismiss(id: number) {
    queue.value = queue.value.filter((toast) => toast.id !== id)
  }

  return {
    queue,
    dismiss,
    success: (message: string, action?: Toast['action']) => push(message, 'success', action),
    error: (message: string, action?: Toast['action']) => push(message, 'error', action),
    info: (message: string, action?: Toast['action']) => push(message, 'info', action),
  }
})
