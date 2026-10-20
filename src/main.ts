import { createApp } from 'vue'
import App from './App.vue'
import { registerPlugins } from '@/plugins'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import router from '@/router'

async function bootstrap() {
  const app = createApp(App)
  registerPlugins(app)

  // Paint the right theme and know who is signed in *before* the first render,
  // so there is no flash of the wrong palette and no flash of the login screen.
  useThemeStore().initialize()
  await useAuthStore().initialize()
  await router.isReady()

  app.mount('#app')
  warmRoutes()
}

/**
 * Pages are code-split, so the first visit to each would wait on a download
 * (and, in dev, a compile) and briefly show nothing. Once the first screen is
 * up and the browser is idle, fetch every page's code so switching modules is
 * instant. exceljs stays out of this: it loads only when a file is picked.
 */
function warmRoutes() {
  const idle = window.requestIdleCallback ?? ((run: () => void) => window.setTimeout(run, 400))
  idle(() => {
    for (const route of router.getRoutes()) {
      const component = route.components?.default
      if (typeof component === 'function') (component as () => Promise<unknown>)().catch(() => undefined)
    }
  })
}

bootstrap()
