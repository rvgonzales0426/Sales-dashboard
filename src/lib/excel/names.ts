/**
 * Person identity across uploads.
 *
 * The workbook has no employee ID, so a person IS their name — normalized hard
 * enough that "Piñuela", "PINUELA" and " pinuela " agree, but no further. Near
 * misses ("Pinuella") are not merged silently; the diff surfaces them with a
 * "same person as…?" suggestion and an admin decides.
 */

/** One half of a name key: accents off, lowercase, punctuation to spaces. */
export function normalizeNamePart(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** 'last|first' — the stable key the database matches people on. */
export function nameKey(lastName: string, firstName: string): string {
  return `${normalizeNamePart(lastName)}|${normalizeNamePart(firstName)}`
}

/** True when a key has both halves; an empty half means a missing name. */
export function isCompleteKey(key: string): boolean {
  const [last, first] = key.split('|')
  return Boolean(last && first)
}

function titleCaseWord(word: string): string {
  // Keep hyphenated and apostrophe'd parts capitalized: "dela-cruz" → "Dela-Cruz"
  return word
    .split(/([-'’])/)
    .map((part) => (part.length > 0 && !/[-'’]/.test(part) ? part[0].toUpperCase() + part.slice(1) : part))
    .join('')
}

/**
 * Display form of a name cell: trimmed, single-spaced, and title-cased when the
 * sheet shouted it ("LORIEN MAE") or whispered it ("lorien mae"). Mixed case is
 * someone's deliberate spelling ("McArthur", "de la Peña") and is left alone.
 */
export function cleanName(raw: string): string {
  const collapsed = raw.replace(/\s+/g, ' ').trim()
  if (!collapsed) return ''
  const letters = collapsed.replace(/[^\p{L}]/gu, '')
  const shouted = letters.length > 1 && letters === letters.toUpperCase()
  const whispered = letters === letters.toLowerCase()
  if (!shouted && !whispered) return collapsed
  return collapsed.toLowerCase().split(' ').map(titleCaseWord).join(' ')
}

export function displayName(lastName: string, firstName: string): string {
  return `${lastName}, ${firstName}`
}

/** Levenshtein distance, two-row. Names are short; this is plenty fast. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  let current = new Array<number>(b.length + 1)
  for (let i = 1; i <= a.length; i++) {
    current[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost)
    }
    ;[previous, current] = [current, previous]
  }
  return previous[b.length]
}

/** 1 = identical, 0 = nothing alike. */
export function stringSimilarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length)
  if (longest === 0) return 1
  return 1 - editDistance(a, b) / longest
}

/**
 * How alike two name keys are. Also catches first and last swapped into the
 * wrong columns ("Arlene | Pinuela").
 */
export function nameKeySimilarity(a: string, b: string): number {
  const [aLast = '', aFirst = ''] = a.split('|')
  const [bLast = '', bFirst = ''] = b.split('|')
  const straight = (stringSimilarity(aLast, bLast) + stringSimilarity(aFirst, bFirst)) / 2
  const swapped = (stringSimilarity(aLast, bFirst) + stringSimilarity(aFirst, bLast)) / 2
  return Math.max(straight, swapped)
}

/** Above this, a new name is offered as "same person as…?". */
export const SUGGESTION_THRESHOLD = 0.75
