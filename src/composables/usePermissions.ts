import { useAuthStore } from '@/stores/auth'
import type { PermissionKey } from '@/config/permissions'

/**
 * Permission checks for components. Sugar over the auth store so markup reads
 * as `v-if="can(PERMISSIONS.UsersWrite)"`.
 *
 * Hiding a button with this is a courtesy to the user, not a security control.
 * The same check runs in Postgres via has_permission(), which is what actually
 * stops someone who opens devtools.
 */
export function usePermissions() {
  const auth = useAuthStore()

  return {
    can: (permission: PermissionKey | string) => auth.can(permission),
    canAny: (permissions: readonly string[]) => auth.canAny(permissions),
    isAdmin: () => auth.isAdmin,
  }
}
