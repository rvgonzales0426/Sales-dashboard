import type { App } from 'vue'
import { createPinia } from 'pinia'
import vuetify from './vuetify'
import router from '@/router'

export function registerPlugins(app: App) {
  app.use(createPinia()).use(vuetify).use(router)
}
