import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import vuetify from '@/plugins/vuetify'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'thesis-template-theme'
const darkQuery = window.matchMedia?.('(prefers-color-scheme: dark)')

function readStored(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

export const useThemeStore = defineStore('theme', () => {
  /** What the user picked. 'system' follows the OS and keeps following it. */
  const mode = ref<ThemeMode>(readStored())

  /** Kept in a ref so `active` recomputes when the OS preference flips. */
  const systemDark = ref(darkQuery?.matches ?? false)

  /** What is actually painted right now. */
  const active = computed<'light' | 'dark'>(() =>
    mode.value === 'system' ? (systemDark.value ? 'dark' : 'light') : mode.value,
  )

  const isDark = computed(() => active.value === 'dark')

  function apply() {
    vuetify.theme.global.name.value = active.value
    // Lets the browser paint native chrome (scrollbars, form widgets, overscroll
    // areas) to match, instead of flashing white around a dark app.
    document.documentElement.style.colorScheme = active.value
  }

  function set(next: ThemeMode) {
    mode.value = next
    localStorage.setItem(STORAGE_KEY, next)
    apply()
  }

  /** App-bar toggle: always resolves to an explicit light/dark choice. */
  function toggle() {
    set(isDark.value ? 'light' : 'dark')
  }

  /** Called once from main.ts, before mount, so there is no theme flash. */
  function initialize() {
    apply()
    darkQuery?.addEventListener('change', (event) => {
      systemDark.value = event.matches
      if (mode.value === 'system') apply()
    })
  }

  return { mode, active, isDark, set, toggle, initialize }
})
