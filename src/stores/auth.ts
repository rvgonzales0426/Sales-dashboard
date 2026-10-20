import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, toMessage } from '@/lib/supabase'
import { roleLabel } from '@/config/roles'
import type { PermissionKey } from '@/config/permissions'
import type { Profile, ProfileUpdate, Role } from '@/types'

/** Selects the profile together with its role row in one round trip. */
const PROFILE_SELECT = '*, role:roles(*)'

/**
 * Session, the signed-in user's own profile, their effective permissions, and
 * every auth call in the app. Nothing outside this store touches supabase.auth.
 */
export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const user = ref<User | null>(null)
  const profile = ref<Profile | null>(null)

  /**
   * Flattened permission keys for the signed-in user, from my_permissions().
   * A superuser role expands to every key, so `can()` needs no special case.
   */
  const permissions = ref<Set<string>>(new Set())

  /** True until the first session check resolves — the router waits on this. */
  const initializing = ref(true)

  const isAuthenticated = computed(() => Boolean(session.value && profile.value?.is_active))
  const role = computed<Role | null>(() => profile.value?.role ?? null)
  const isAdmin = computed(() => role.value?.is_superuser ?? false)
  const currentRoleLabel = computed(() => roleLabel(role.value))

  const displayName = computed(
    () => profile.value?.full_name?.trim() || profile.value?.email?.split('@')[0] || 'Account',
  )

  const initials = computed(() =>
    displayName.value
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join(''),
  )

  /**
   * The check to reach for everywhere. Hiding UI with it is a courtesy; RLS
   * runs the same check server-side, which is what actually stops anyone.
   */
  function can(permission: PermissionKey | string): boolean {
    return permissions.value.has(permission)
  }

  /** True if the user holds at least one of these. */
  function canAny(required: readonly string[]): boolean {
    return required.some((permission) => permissions.value.has(permission))
  }

  async function loadPermissions() {
    const { data, error } = await supabase.rpc('my_permissions')
    if (error) throw new Error(toMessage(error))
    permissions.value = new Set((data as string[] | null) ?? [])
  }

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('id', userId)
      .maybeSingle()

    if (error) throw new Error(toMessage(error))
    profile.value = (data as Profile) ?? null

    if (profile.value?.is_active) {
      await loadPermissions()
    } else {
      permissions.value = new Set()
    }
    return profile.value
  }

  function clear() {
    session.value = null
    user.value = null
    profile.value = null
    permissions.value = new Set()
  }

  /**
   * Restores a persisted session and subscribes to auth changes.
   * Called once from main.ts before the app mounts.
   */
  async function initialize() {
    try {
      const { data } = await supabase.auth.getSession()
      session.value = data.session
      user.value = data.session?.user ?? null
      if (user.value) await loadProfile(user.value.id)
    } catch (error) {
      // A failed profile read must not stop the app from mounting — the guard
      // will send them to /login, which is the right outcome anyway.
      console.error('[auth] Could not load the profile on startup.', error)
      profile.value = null
      permissions.value = new Set()
    } finally {
      initializing.value = false
    }

    supabase.auth.onAuthStateChange((event, nextSession) => {
      session.value = nextSession
      user.value = nextSession?.user ?? null

      if (!nextSession) {
        profile.value = null
        permissions.value = new Set()
        return
      }
      // PASSWORD_RECOVERY hands us a short-lived session purely so the user can
      // set a new password; the reset page handles it, we just keep the session.
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        loadProfile(nextSession.user.id).catch((error) => {
          console.error('[auth] Could not refresh the profile.', error)
        })
      }
    })
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(toMessage(error))

    const loaded = await loadProfile(data.user.id)
    if (loaded && !loaded.is_active) {
      await supabase.auth.signOut()
      clear()
      throw new Error('This account has been deactivated. Ask an admin to restore it.')
    }
    return loaded
  }

  async function signUp(email: string, password: string, fullName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      // The database trigger reads full_name out of this metadata when it
      // creates the profile row. It deliberately ignores any role in here.
      options: { data: { full_name: fullName } },
    })
    if (error) throw new Error(toMessage(error))
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(toMessage(error))
    clear()
  }

  async function sendPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw new Error(toMessage(error))
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error(toMessage(error))
  }

  /** The signed-in user editing their own profile. Editing *other* people
   *  goes through stores/users.ts instead. */
  async function updateProfile(changes: ProfileUpdate) {
    if (!user.value) throw new Error('You are not signed in.')

    const { data, error } = await supabase
      .from('profiles')
      .update(changes)
      .eq('id', user.value.id)
      .select(PROFILE_SELECT)
      .single()

    if (error) throw new Error(toMessage(error))
    profile.value = data as Profile
    return profile.value
  }

  return {
    session,
    user,
    profile,
    permissions,
    initializing,
    isAuthenticated,
    role,
    isAdmin,
    currentRoleLabel,
    displayName,
    initials,
    can,
    canAny,
    initialize,
    signIn,
    signUp,
    signOut,
    sendPasswordReset,
    updatePassword,
    updateProfile,
  }
})
