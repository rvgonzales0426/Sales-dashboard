/* ---------------------------------------------------------------------------
 * DESIGN TOKENS — the single source for both display modes.
 *
 * Direction: a real instrument cluster. Matte graphite at night, warm-neutral
 * gray by day, one accent (instrument amber), status colours reserved for
 * status. No glow, no gradients, no glass — see tests/unit/design/guard.test.ts.
 *
 * Every value below was checked, not eyeballed:
 *  - text inks ≥ 4.5:1 and graphics ≥ 3:1 against both surface and raised;
 *  - area hues validated (dataviz validate_palette.js, all-pairs, both modes):
 *    CVD ΔE 11.1, normal-vision ΔE 17.5, all ≥ 3:1 on all four surfaces.
 * The Day theme ("Ivory") is designed, not inverted: warm ivory and stone
 * surfaces, a piano-black navigation rail, cognac for the accent, and the
 * instrument cluster kept black inside a chrome rim — the black dash in an
 * ivory cabin. Status hues take deeper steps so they hold 3:1 on ivory.
 *
 * BRAND: the accent is the one strong hue. To use a brand colour, replace
 * `accent` (and its Day step, re-checked for 3:1) and nothing else.
 * ------------------------------------------------------------------------- */

export interface ModeTokens {
  /** Page plane. */
  surface: string
  /** Panels and the cluster body sit one step up. */
  raised: string
  /** A quiet alternate for table heads and hovered rows. */
  raisedAlt: string
  /** The dial face: matte, slightly off the panel so the bezel reads. */
  dialFace: string
  line: string
  lineStrong: string
  /** Unused part of an arc track. */
  track: string
  ink: string
  /** Secondary ink, 66% of ink over raised — ≥ 4.5:1. */
  ink2: string
  /** Minor ticks and other non-text marks — ≥ 3:1. */
  ink3: string
  accent: string
  onAccent: string
  /** Buttons. Night: the amber accent. Day: piano black, like the console. */
  primary: string
  onPrimary: string
  /** The navigation rail. Day keeps it piano black against the ivory cabin. */
  sidebar: string
  sidebarRaised: string
  sidebarInk: string
  sidebarInk2: string
  sidebarAccent: string
  /** The polished rim around the instrument cluster. */
  chrome: string
  chromeDeep: string
  /** Contrast stitching on the cluster housing (Day only). */
  stitch: string
  good: string
  caution: string
  critical: string
  /** Status hues stepped for text use (≥ 4.5:1). */
  goodInk: string
  cautionInk: string
  criticalInk: string
  areas: { north: string; south: string; caraga: string }
}

export const night: ModeTokens = {
  surface: '#16181B',
  raised: '#1D2024',
  raisedAlt: '#22262B',
  dialFace: '#141619',
  line: '#2B2F34',
  lineStrong: '#3A3F46',
  track: '#30353B',
  ink: '#ECEDEE',
  ink2: '#A6A7A9',
  ink3: '#7A7C7F',
  accent: '#F29A1F',
  onAccent: '#16181B',
  primary: '#F29A1F',
  onPrimary: '#16181B',
  sidebar: '#1A1C1F',
  sidebarRaised: '#24272B',
  sidebarInk: '#ECEDEE',
  sidebarInk2: '#A6A7A9',
  sidebarAccent: '#F29A1F',
  chrome: '#3A3F46',
  chromeDeep: '#0F1012',
  stitch: '#CBBFA9',
  good: '#3FA66B',
  caution: '#E0A526',
  critical: '#D6453D',
  goodInk: '#4DB57A',
  cautionInk: '#E0A526',
  criticalInk: '#E25B53',
  areas: { north: '#5389C5', south: '#9A537D', caraga: '#7C802A' },
}

export const day: ModeTokens = {
  // "Ivory": the cabin of a grand tourer — ivory leather, taupe seams,
  // piano-black console, polished chrome. Warm, never pure white.
  surface: '#EFEAE1',
  raised: '#FBF8F3',
  raisedAlt: '#F4EFE7',
  dialFace: '#F6F2EC',
  line: '#DCD3C4',
  lineStrong: '#BFB3A0',
  track: '#E2DACD',
  ink: '#1C1A17',
  ink2: '#5F5B55',
  ink3: '#7B766F',
  // Cognac: the amber accent deepened for ivory, like saddle leather.
  accent: '#8C4F1C',
  onAccent: '#FBF8F3',
  primary: '#1C1A17',
  onPrimary: '#FBF8F3',
  sidebar: '#131416',
  sidebarRaised: '#1E1F22',
  sidebarInk: '#EDE7DC',
  sidebarInk2: '#9A9791',
  sidebarAccent: '#D9A066',
  chrome: '#D8D4CC',
  chromeDeep: '#8E8A83',
  stitch: '#CBBFA9',
  good: '#2B7A4E',
  caution: '#946500',
  critical: '#B8352E',
  goodInk: '#256B44',
  cautionInk: '#835600',
  criticalInk: '#A3302A',
  areas: { north: '#5389C5', south: '#9A537D', caraga: '#7C802A' },
}

/** Type scale (px). Large numerals dominate; labels recede. */
export const type = {
  micro: 11,
  label: 12,
  body: 15,
  title: 18,
  page: 26,
  readout: 44,
  hero: 72,
} as const

/** 8-point spacing. */
export const space = (steps: number) => steps * 8
