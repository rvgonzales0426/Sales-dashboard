import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import '@/styles/main.scss'

import { createVuetify, type ThemeDefinition } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi'

/* ---------------------------------------------------------------------------
 * PALETTE
 *
 * Light = "Paper": warm off-white page plane, white surfaces, deep pine accent.
 * Dark  = "Graphite": near-black plane, raised surfaces, mint accent.
 *
 * The dark theme is designed, not inverted - the accent is a different step of
 * the hue (deep pine is unreadable on black), and surfaces get *lighter* as
 * they rise, the opposite of the light theme's behaviour.
 *
 * Chart series colours were validated for colour-vision-deficiency separation
 * and surface contrast. If you re-hue them, re-validate them.
 * ------------------------------------------------------------------------- */

const light: ThemeDefinition = {
  dark: false,
  colors: {
    background: '#F5F5F1',
    surface: '#FFFFFF',
    'surface-alt': '#FAFAF8',
    'surface-variant': '#EFEFE9',
    'on-surface-variant': '#5E6763',
    primary: '#0F5C4C',
    'primary-soft': '#E4EFEB',
    secondary: '#5E6763',
    'text-secondary': '#5E6763',
    scrollbar: '#D6D6CD',
    success: '#1B7F4E',
    warning: '#B5731F',
    error: '#B23A32',
    info: '#2E6FA8',
    'on-background': '#161A18',
    'on-surface': '#161A18',
    'on-primary': '#FFFFFF',
  },
  variables: {
    'border-color': '#E3E3DC',
    'border-opacity': 1,
    'high-emphasis-opacity': 1,
    'medium-emphasis-opacity': 1,
    'hover-opacity': 0.04,
    'focus-opacity': 0.06,
    'selected-opacity': 0.06,
    'activated-opacity': 0.06,
    'disabled-opacity': 0.38,
    'chart-1': '#12876F',
    'chart-2': '#C97A14',
    'chart-3': '#2E6FA8',
    'chart-4': '#C24455',
    'chart-grid': '#E7E7E0',
    'chart-axis': '#C9C9BF',
  },
}

const dark: ThemeDefinition = {
  dark: true,
  colors: {
    background: '#0D0F0E',
    surface: '#161917',
    'surface-alt': '#1C201E',
    'surface-variant': '#232825',
    'on-surface-variant': '#949D98',
    primary: '#4CC49E',
    'primary-soft': '#16302A',
    secondary: '#949D98',
    'text-secondary': '#949D98',
    scrollbar: '#2E3431',
    success: '#3FB574',
    warning: '#D9A03C',
    error: '#E0685E',
    info: '#5C9BD6',
    'on-background': '#E8EBE8',
    'on-surface': '#E8EBE8',
    'on-primary': '#08130F',
  },
  variables: {
    'border-color': '#262B28',
    'border-opacity': 1,
    'high-emphasis-opacity': 1,
    'medium-emphasis-opacity': 1,
    'hover-opacity': 0.06,
    'focus-opacity': 0.09,
    'selected-opacity': 0.09,
    'activated-opacity': 0.09,
    'disabled-opacity': 0.38,
    'chart-1': '#199E7E',
    'chart-2': '#B8811F',
    'chart-3': '#3D82C9',
    'chart-4': '#CB5462',
    'chart-grid': '#222724',
    'chart-axis': '#333A36',
  },
}

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
