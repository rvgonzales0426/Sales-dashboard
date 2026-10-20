import { computed } from 'vue'
import { useRoute } from 'vue-router'
import type { Crumb } from '@/types'

/**
 * Builds the app-bar trail from route meta. A route only needs `meta.title`;
 * nesting a route under another automatically nests its crumb.
 */
export function useBreadcrumbs() {
  const route = useRoute()

  const crumbs = computed<Crumb[]>(() => {
    const trail: Crumb[] = [{ title: 'Team cockpit', to: '/' }]

    for (const matched of route.matched) {
      if (!matched.meta?.title) continue
      if (matched.path === '/' || matched.path === '') continue
      trail.push({ title: matched.meta.title as string, to: matched.path })
    }

    // The cockpit is home — don't render "Team cockpit / Team cockpit".
    if (trail.length === 1) return [{ title: 'Team cockpit', disabled: true }]

    const last = trail[trail.length - 1]
    return [...trail.slice(0, -1), { ...last, to: undefined, disabled: true }]
  })

  return { crumbs }
}
