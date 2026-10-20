import { createRouter, createWebHistory } from 'vue-router'
import { routes } from './routes'
import { authGuard, titleGuard } from './guards'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
})

router.beforeEach(authGuard)
router.afterEach(titleGuard)

export default router
