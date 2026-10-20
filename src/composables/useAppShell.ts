import { ref, watch } from 'vue'
import { useDisplay } from 'vuetify'

const RAIL_KEY = 'thesis-template-sidebar-rail'

/**
 * Sidebar state for the app shell. Collapsed/expanded is remembered on desktop;
 * on mobile the sidebar is a temporary drawer that always starts closed.
 */
export function useAppShell() {
  const { mdAndDown } = useDisplay()

  const drawer = ref(!mdAndDown.value)
  const rail = ref(localStorage.getItem(RAIL_KEY) === '1')

  watch(mdAndDown, (isMobile) => {
    drawer.value = !isMobile
    if (isMobile) rail.value = false
  })

  function toggleSidebar() {
    if (mdAndDown.value) {
      drawer.value = !drawer.value
      return
    }
    rail.value = !rail.value
    localStorage.setItem(RAIL_KEY, rail.value ? '1' : '0')
  }

  return { drawer, rail, isMobile: mdAndDown, toggleSidebar }
}
