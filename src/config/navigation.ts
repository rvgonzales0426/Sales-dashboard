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
    items: [
      { title: 'Team cockpit', icon: 'mdi-speedometer', to: '/' },
      { title: 'Area comparison', icon: 'mdi-view-column-outline', to: '/areas', permissions: [PERMISSIONS.SalesRead] },
      { title: 'Leaderboard', icon: 'mdi-format-list-numbered', to: '/leaderboard', permissions: [PERMISSIONS.SalesRead] },
    ],
  },
  {
    title: 'Data',
    items: [
      {
        title: 'Upload workbook',
        icon: 'mdi-tray-arrow-up',
        to: '/upload',
        permissions: [PERMISSIONS.UploadsWrite],
      },
      {
        title: 'Upload history',
        icon: 'mdi-history',
        to: '/upload/history',
        permissions: [PERMISSIONS.UploadsRead, PERMISSIONS.UploadsWrite],
      },
      { title: 'Targets', icon: 'mdi-bullseye-arrow', to: '/admin/targets', permissions: [PERMISSIONS.TargetsWrite] },
      { title: 'People', icon: 'mdi-account-group-outline', to: '/admin/people', permissions: [PERMISSIONS.PeopleWrite] },
    ],
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
      { title: 'Audit log', icon: 'mdi-text-box-search-outline', to: '/admin/audit', permissions: [PERMISSIONS.AuditRead] },
      { title: 'Sales settings', icon: 'mdi-tune-variant', to: '/admin/sales-settings', permissions: [PERMISSIONS.SettingsWrite] },
    ],
  },
  {
    title: 'Account',
    items: [{ title: 'Settings', icon: 'mdi-cog-outline', to: '/settings' }],
  },
]
