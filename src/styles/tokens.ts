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
 * The Day theme is designed, not inverted: amber and the status hues take
 * deeper steps, because the Night values fall under 3:1 on light gray.
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
  good: '#3FA66B',
  caution: '#E0A526',
  critical: '#D6453D',
  goodInk: '#4DB57A',
  cautionInk: '#E0A526',
  criticalInk: '#E25B53',
  areas: { north: '#5389C5', south: '#9A537D', caraga: '#7C802A' },
}

export const day: ModeTokens = {
  surface: '#E9EAEC',
  raised: '#F4F5F6',
  raisedAlt: '#EEEFF1',
  dialFace: '#F0F1F2',
  line: '#C9CCD1',
  lineStrong: '#AEB2B8',
  track: '#D3D6DA',
  ink: '#16181B',
  ink2: '#616365',
  ink3: '#7D7F82',
  accent: '#A85F00',
  onAccent: '#FFFFFF',
  good: '#2B7A4E',
  caution: '#9A6B00',
  critical: '#C23A33',
  goodInk: '#256B44',
  cautionInk: '#8A5A00',
  criticalInk: '#A8322C',
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
