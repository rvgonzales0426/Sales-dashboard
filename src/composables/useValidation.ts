/**
 * Shared field rules. Vuetify rules return `true` or an error string, and the
 * string is what the user reads — so write them as instructions, not verdicts.
 */
export type Rule = (value: unknown) => true | string

const asString = (value: unknown) => (typeof value === 'string' ? value : String(value ?? ''))

export const required =
  (field = 'This field'): Rule =>
  (value) =>
    asString(value).trim().length > 0 || `${field} is required.`

export const email: Rule = (value) => {
  const text = asString(value).trim()
  if (!text) return 'Enter your email address.'
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text) || 'That does not look like an email address.'
}

export const minLength =
  (length: number, field = 'This field'): Rule =>
  (value) =>
    asString(value).length >= length || `${field} must be at least ${length} characters.`

export const maxLength =
  (length: number, field = 'This field'): Rule =>
  (value) =>
    asString(value).length <= length || `${field} must be ${length} characters or fewer.`

/** Deliberately modest: one rule the user can satisfy, not a checklist. */
export const password: Rule[] = [
  required('Password'),
  minLength(8, 'Password'),
  (value) =>
    /[A-Za-z]/.test(asString(value)) ||
    'Use at least one letter so the password is not only digits.',
]

export const matches =
  (other: () => string, message = 'The two passwords do not match.'): Rule =>
  (value) =>
    asString(value) === other() || message

export function useValidation() {
  return { required, email, minLength, maxLength, password, matches }
}
