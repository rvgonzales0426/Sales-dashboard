import type { NavigationGuardWithThis } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const APP_NAME = import.meta.env.VITE_APP_NAME || 'Thesis Template'

/**
 * One guard covering both questions: are you signed in, and are you allowed
 * here. Route meta is the only input — see router/routes.ts.
 */
export const authGuard: NavigationGuardWithThis<undefined> = async (to) => {
  const auth = useAuthStore()

  // main.ts awaits initialize() before mounting, so this is only a safety net
  // for a hard refresh that races the session restore.
  while (auth.initializing) {
    await new Promise((resolve) => setTimeout(resolve, 16))
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
  }

  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }

  // Permission, not role: a route asks for a capability, and whichever roles
  // currently hold it get in. Renaming or adding a role changes nothing here.
  if (to.meta.permissions && !auth.canAny(to.meta.permissions)) {
    return { name: 'forbidden' }
  }

  return true
}

export function titleGuard(to: { meta: { title?: string } }) {
  document.title = to.meta.title ? `${to.meta.title} · ${APP_NAME}` : APP_NAME
}
