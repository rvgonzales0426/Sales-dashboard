/* ---------------------------------------------------------------------------
 * PERMISSIONS
 *
 * The vocabulary of capabilities, mirrored from the `permissions` table.
 * Roles are data and change at runtime; these keys are code and change by
 * migration, which is what makes them safe to reference in policies.
 *
 * To add one:
 *   1. Add the constant below.
 *   2. Insert the matching row in a migration (see 0002_rls.sql, bottom).
 *   3. Use it in a route's meta.permissions, a `can()` call, or an RLS policy.
 *   4. Grant it to roles in the app — no deploy needed for that part.
 *
 * Keys are '<area>.<verb>'. Keep them about capabilities, not job titles:
 * 'invoices.approve', never 'is_manager'.
 * ------------------------------------------------------------------------- */

export const PERMISSIONS = {
  UsersRead: 'users.read',
  UsersWrite: 'users.write',
  UsersInvite: 'users.invite',
  RolesRead: 'roles.read',
  RolesWrite: 'roles.write',
} as const

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

/** Order categories appear in the role editor. Unlisted ones sort last, A-Z. */
export const CATEGORY_ORDER = ['Users', 'Access control'] as const
