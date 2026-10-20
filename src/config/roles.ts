import type { Role } from '@/types'

/* ---------------------------------------------------------------------------
 * ROLES (client-side helpers)
 *
 * Roles live in the database and are created at runtime, so there is no list
 * of them here — only the two keys the application itself depends on, and the
 * presentation rules for showing any role.
 * ------------------------------------------------------------------------- */

/** Keys the app relies on. The database marks these rows is_system. */
export const SYSTEM_ROLE_KEYS = {
  /** Holds every permission implicitly, including ones added later. */
  admin: 'admin',
  /** Assigned to every new signup by the database trigger. */
  user: 'user',
} as const

export const DEFAULT_ROLE_KEY = SYSTEM_ROLE_KEYS.user

/**
 * Chip colour for a role. Derived from privilege rather than hard-coded per
 * role, because a role created next month still needs a colour.
 */
export function roleColor(role: Role | null | undefined): string {
  if (!role) return 'secondary'
  if (role.is_superuser) return 'primary'
  if (role.rank >= 50) return 'info'
  return 'secondary'
}

/** What to show when a profile has no role — deleted, or never assigned. */
export const NO_ROLE_LABEL = 'No role'

export function roleLabel(role: Role | null | undefined): string {
  return role?.label ?? NO_ROLE_LABEL
}
