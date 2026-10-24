import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import '@/styles/fonts.css'
import '@/styles/main.scss'

import { createVuetify, type ThemeDefinition } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import { day, night, type ModeTokens } from '@/styles/tokens'

/* ---------------------------------------------------------------------------
 * PALETTE — built from src/styles/tokens.ts, the one place colours live.
 *
 * Vuetify's 'light' and 'dark' themes are the cluster's Day and Night modes.
 * Status colours (good / caution / critical) are reserved for status: tell-
 * tales, pace pills, the fuel gauge, issue flags. The *-ink steps are for
 * status-coloured TEXT, which needs 4.5:1 where a mark needs only 3:1.
 * ------------------------------------------------------------------------- */

function themeFrom(t: ModeTokens, dark: boolean): ThemeDefinition {
  return {
    dark,
    colors: {
      background: t.surface,
      surface: t.raised,
      'surface-alt': t.raisedAlt,
      'surface-variant': t.raisedAlt,
      'on-surface-variant': t.ink2,
      'dial-face': t.dialFace,
      line: t.line,
      'line-strong': t.lineStrong,
      track: t.track,
      ink: t.ink,
      'ink-2': t.ink2,
      'ink-3': t.ink3,
      primary: t.primary,
      'primary-soft': t.raisedAlt,
      accent: t.accent,
      'on-accent': t.onAccent,
      sidebar: t.sidebar,
      'sidebar-raised': t.sidebarRaised,
      'on-sidebar': t.sidebarInk,
      'sidebar-ink-2': t.sidebarInk2,
      'sidebar-accent': t.sidebarAccent,
      chrome: t.chrome,
      'chrome-deep': t.chromeDeep,
      stitch: t.stitch,
      secondary: t.ink2,
      'text-secondary': t.ink2,
      scrollbar: t.lineStrong,
      good: t.good,
      caution: t.caution,
      critical: t.critical,
      'good-ink': t.goodInk,
      'caution-ink': t.cautionInk,
      'critical-ink': t.criticalInk,
      // Vuetify's own status names map onto the text-safe steps, so alerts
      // and form errors stay readable.
      success: t.goodInk,
      warning: t.cautionInk,
      error: t.criticalInk,
      info: t.ink2,
      'area-north': t.areas.north,
      'area-south': t.areas.south,
      'area-caraga': t.areas.caraga,
      'on-background': t.ink,
      'on-surface': t.ink,
      'on-primary': t.onPrimary,
    },
    variables: {
      'border-color': hexTriplet(t.line),
      'border-opacity': 1,
      'high-emphasis-opacity': 1,
      'medium-emphasis-opacity': 1,
      'hover-opacity': dark ? 0.06 : 0.04,
      'focus-opacity': dark ? 0.09 : 0.06,
      'selected-opacity': dark ? 0.09 : 0.06,
      'activated-opacity': dark ? 0.09 : 0.06,
      'disabled-opacity': 0.38,
      'chart-grid': hexTriplet(t.line),
      'chart-axis': hexTriplet(t.lineStrong),
    },
  }
}

/** Vuetify reads border-color as an "r,g,b" triplet. */
function hexTriplet(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

const light = themeFrom(day, false)
const dark = themeFrom(night, true)

/* ---------------------------------------------------------------------------
 * COMPONENT DEFAULTS
 *
 * This block is what keeps the app from looking like stock Material. Feature
 * code writes <v-btn>Save changes</v-btn> and gets the house style for free.
 * If you catch yourself passing the same prop at every call site, it belongs
 * here instead.
 * ------------------------------------------------------------------------- */

const defaults = {
  global: {
    // Material's ink ripple reads as "phone app". Flat hover states read as
    // "tool", which is what a dashboard is.
    ripple: false,
  },

  VBtn: {
    variant: 'flat' as const,
    elevation: 0,
    height: 38,
    class: 'btn-tuned',
  },

  // Panels sit *in* the page: flat, hairline border, 10px radius.
  VCard: {
    variant: 'flat' as const,
    color: 'surface',
    border: true,
    class: 'rounded-panel',
  },
  VCardTitle: { class: 'text-subtitle-1 font-weight-medium px-5 pt-4 pb-1' },
  VCardSubtitle: { class: 'px-5 pb-3 text-body-2' },
  VCardText: { class: 'px-5 py-4' },
  VCardActions: { class: 'px-5 pb-4 pt-0' },

  VSheet: { color: 'surface' },

  // Overlays float above the page: 14px radius, the one real shadow.
  VDialog: { maxWidth: 520, transition: 'fade-transition' },
  VMenu: { offset: 6, transition: 'fade-transition' },

  VTextField: {
    variant: 'outlined' as const,
    density: 'comfortable' as const,
    color: 'primary',
    hideDetails: 'auto' as const,
  },
  VTextarea: {
    variant: 'outlined' as const,
    density: 'comfortable' as const,
    color: 'primary',
    hideDetails: 'auto' as const,
    autoGrow: true,
    rows: 3,
  },
  VSelect: {
    variant: 'outlined' as const,
    density: 'comfortable' as const,
    color: 'primary',
    hideDetails: 'auto' as const,
  },
  VAutocomplete: {
    variant: 'outlined' as const,
    density: 'comfortable' as const,
    color: 'primary',
    hideDetails: 'auto' as const,
  },
  VCheckbox: { color: 'primary', density: 'comfortable' as const, hideDetails: 'auto' as const },
  VSwitch: {
    color: 'primary',
    inset: true,
    density: 'comfortable' as const,
    hideDetails: 'auto' as const,
  },
  VRadioGroup: { color: 'primary', hideDetails: 'auto' as const },

  VList: { density: 'comfortable' as const, class: 'py-2' },
  VListItem: { rounded: true, minHeight: 40 },

  VChip: { size: 'small' as const, variant: 'tonal' as const, class: 'font-weight-medium' },
  VAlert: { variant: 'tonal' as const, density: 'comfortable' as const, class: 'rounded-panel' },

  VDataTable: { density: 'comfortable' as const, hover: true, itemsPerPage: 10 },

  VTabs: { color: 'primary', density: 'comfortable' as const, sliderColor: 'primary' },
  VTab: { class: 'btn-tuned' },

  VProgressLinear: { color: 'primary', height: 2, rounded: false },
  VProgressCircular: { color: 'primary' },
  VSkeletonLoader: { boilerplate: false, color: 'surface' },

  VTooltip: { location: 'top' as const, contentClass: 'text-caption' },
  VSnackbar: { timeout: 4500, location: 'bottom right' as const },

  VPagination: {
    density: 'comfortable' as const,
    variant: 'flat' as const,
    activeColor: 'primary',
    totalVisible: 5,
    rounded: true,
  },

  VAvatar: { color: 'primary-soft' },
  VDivider: { color: 'surface-variant' },
}

export default createVuetify({
  theme: {
    defaultTheme: 'light', // replaced at runtime by stores/theme.ts
    themes: { light, dark },
  },
  defaults,
  icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
  display: { mobileBreakpoint: 'md' },
})
