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
        path: '',
        name: 'dashboard',
        component: () => import('@/pages/dashboard/DashboardView.vue'),
        meta: { title: 'Dashboard' },
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
