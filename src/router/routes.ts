import type { RouteRecordRaw } from 'vue-router'
import type { PermissionKey } from '@/config/permissions'

declare module 'vue-router' {
  interface RouteMeta {
    /** Redirects to /login when there is no active session. */
    requiresAuth?: boolean
    /** Bounces signed-in users away (login, register, forgot password). */
    guestOnly?: boolean
    /**
     * Permissions that grant access. Holding ANY one of them is enough.
     * Omit to allow any signed-in user.
     */
    permissions?: readonly PermissionKey[]
    /** Page + breadcrumb label, and the document title suffix. */
    title?: string
  }
}

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        // Landing page. Without sales access it explains how to get it.
        path: '',
        name: 'dashboard',
        component: () => import('@/pages/cockpit/TeamCockpitView.vue'),
        meta: { title: 'Team cockpit' },
      },
      {
        path: 'agents/:personId',
        name: 'agent',
        component: () => import('@/pages/cockpit/AgentCockpitView.vue'),
        props: true,
        meta: { title: 'Agent cockpit', permissions: ['sales.read', 'sales.self'] },
      },
      {
        path: 'areas',
        name: 'areas',
        component: () => import('@/pages/areas/AreaComparisonView.vue'),
        meta: { title: 'Area comparison', permissions: ['sales.read'] },
      },
      {
        path: 'leaderboard',
        name: 'leaderboard',
        component: () => import('@/pages/leaderboard/LeaderboardView.vue'),
        meta: { title: 'Leaderboard', permissions: ['sales.read'] },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/pages/settings/SettingsView.vue'),
        meta: { title: 'Settings' },
      },
      {
        // Adding a protected route: drop it in here and list the permissions
        // that grant access. Nothing else to wire up — the guard reads
        // meta.permissions, and roles are assigned those permissions at runtime.
        path: 'admin/users',
        name: 'admin-users',
        component: () => import('@/pages/admin/UsersView.vue'),
        meta: { title: 'Users', permissions: ['users.read'] },
      },
      {
        path: 'upload',
        name: 'upload',
        component: () => import('@/pages/upload/UploadView.vue'),
        meta: { title: 'Upload workbook', permissions: ['uploads.write'] },
      },
      {
        path: 'upload/history',
        name: 'upload-history',
        component: () => import('@/pages/upload/HistoryView.vue'),
        meta: { title: 'Upload history', permissions: ['uploads.read', 'uploads.write'] },
      },
      {
        path: 'admin/targets',
        name: 'admin-targets',
        component: () => import('@/pages/admin/TargetsView.vue'),
        meta: { title: 'Targets', permissions: ['targets.write'] },
      },
      {
        path: 'admin/people',
        name: 'admin-people',
        component: () => import('@/pages/admin/PeopleView.vue'),
        meta: { title: 'People', permissions: ['people.write'] },
      },
      {
        path: 'admin/audit',
        name: 'admin-audit',
        component: () => import('@/pages/admin/AuditView.vue'),
        meta: { title: 'Audit log', permissions: ['audit.read'] },
      },
      {
        path: 'admin/sales-settings',
        name: 'admin-sales-settings',
        component: () => import('@/pages/admin/SalesSettingsView.vue'),
        meta: { title: 'Sales settings', permissions: ['settings.write'] },
      },
      {
        path: 'admin/roles',
        name: 'admin-roles',
        component: () => import('@/pages/admin/RolesView.vue'),
        meta: { title: 'Roles', permissions: ['roles.read'] },
      },
    ],
  },
  {
    path: '/',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [
      {
        path: 'login',
        name: 'login',
        component: () => import('@/pages/auth/LoginView.vue'),
        meta: { guestOnly: true, title: 'Sign in' },
      },
      {
        path: 'register',
        name: 'register',
        component: () => import('@/pages/auth/RegisterView.vue'),
        meta: { guestOnly: true, title: 'Create account' },
      },
      {
        path: 'forgot-password',
        name: 'forgot-password',
        component: () => import('@/pages/auth/ForgotPasswordView.vue'),
        meta: { guestOnly: true, title: 'Reset password' },
      },
      {
        // Reached from the emailed link, which arrives with a recovery session,
        // so this one is deliberately neither guest-only nor auth-required.
        path: 'reset-password',
        name: 'reset-password',
        component: () => import('@/pages/auth/ResetPasswordView.vue'),
        meta: { title: 'Choose a new password' },
      },
    ],
  },
  {
    // Design review: every instrument state in Day and Night, no data needed.
    path: '/dev/instruments',
    name: 'dev-instruments',
    component: () => import('@/pages/dev/InstrumentsGalleryView.vue'),
    meta: { title: 'Instruments' },
  },
  {
    path: '/403',
    name: 'forbidden',
    component: () => import('@/pages/error/ForbiddenView.vue'),
    meta: { title: 'No access' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/pages/error/NotFoundView.vue'),
    meta: { title: 'Page not found' },
  },
]
