import type { NavItem } from '@/types'
import { PERMISSIONS } from './permissions'

/**
 * Sidebar sections. An item with `permissions` is hidden from anyone who holds
 * none of them — but that is cosmetic only. The real gates are the route guard
 * (router/guards.ts) and RLS in the database.
 */
export interface NavSection {
  /** Optional heading. Leave undefined for the first, unlabelled group. */
  title?: string
  items: NavItem[]
}

export const navigation: NavSection[] = [
  {
    items: [{ title: 'Dashboard', icon: 'mdi-view-dashboard-outline', to: '/' }],
  },
  {
    title: 'Administration',
    items: [
      {
        title: 'Users',
        icon: 'mdi-account-multiple-outline',
        to: '/admin/users',
        permissions: [PERMISSIONS.UsersRead],
      },
      {
        title: 'Roles',
        icon: 'mdi-shield-key-outline',
        to: '/admin/roles',
        permissions: [PERMISSIONS.RolesRead],
      },
    ],
  },
  {
    title: 'Account',
    items: [{ title: 'Settings', icon: 'mdi-cog-outline', to: '/settings' }],
  },
]
