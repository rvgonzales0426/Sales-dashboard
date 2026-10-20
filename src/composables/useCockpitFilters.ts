import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DEFAULT_FILTERS, parseFilters, serializeFilters, type CockpitFilters } from '@/lib/cockpit/filters'

/**
 * Filter state lives in the URL query (lib/cockpit/filters.ts). Reading it is
 * a computed over the route; changing it replaces the query, so Back doesn't
 * step through every chip click and a refresh keeps the view.
 */
export function useCockpitFilters() {
  const route = useRoute()
  const router = useRouter()

  const filters = computed<CockpitFilters>(() => parseFilters(route.query))

  /** Query keys that aren't filters (display=wall) are kept as they are. */
  const passthrough = computed(() => {
    const keep: Record<string, string> = {}
    if (typeof route.query.display === 'string') keep.display = route.query.display
    return keep
  })

  function update(changes: Partial<CockpitFilters>) {
    const next = { ...filters.value, ...changes }
    router.replace({ query: { ...passthrough.value, ...serializeFilters(next) } })
  }

  function reset() {
    update({ ...DEFAULT_FILTERS, period: filters.value.period })
  }

  /** The current query, for links that should keep the filter context. */
  const query = computed(() => ({ ...passthrough.value, ...serializeFilters(filters.value) }))

  return { filters, update, reset, query }
}
