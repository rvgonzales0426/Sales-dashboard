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
}

bootstrap()
