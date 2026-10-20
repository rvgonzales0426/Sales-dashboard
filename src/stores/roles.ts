import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase, toMessage } from '@/lib/supabase'
import type { Permission, Role, RoleUpsert } from '@/types'

/**
 * Roles, the permission vocabulary, and the grant matrix between them.
 * Every write here is gated server-side by has_permission('roles.write').
 */
export const useRolesStore = defineStore('roles', () => {
  const roles = ref<Role[]>([])
  const permissions = ref<Permission[]>([])
  /** roleId -> set of permission keys it has been granted. */
  const grants = ref<Record<string, string[]>>({})

  const loading = ref(false)
  const saving = ref(false)
  const loaded = ref(false)

  async function fetchAll() {
    loading.value = true
    try {
      const [rolesResult, permissionsResult, grantsResult] = await Promise.all([
        supabase.from('roles').select('*').order('rank', { ascending: false }),
        supabase.from('permissions').select('*').order('key'),
        supabase.from('role_permissions').select('role_id, permission_key'),
      ])

      if (rolesResult.error) throw new Error(toMessage(rolesResult.error))
      if (permissionsResult.error) throw new Error(toMessage(permissionsResult.error))
      if (grantsResult.error) throw new Error(toMessage(grantsResult.error))

      roles.value = (rolesResult.data ?? []) as Role[]
      permissions.value = (permissionsResult.data ?? []) as Permission[]

      const next: Record<string, string[]> = {}
      for (const row of (grantsResult.data ?? []) as {
        role_id: string
        permission_key: string
      }[]) {
        ;(next[row.role_id] ??= []).push(row.permission_key)
      }
      grants.value = next
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function create(input: RoleUpsert & { key: string }) {
    saving.value = true
    try {
      const { data, error } = await supabase.from('roles').insert(input).select().single()
      if (error) throw new Error(toMessage(error))
      roles.value = [...roles.value, data as Role].sort((a, b) => b.rank - a.rank)
      return data as Role
    } finally {
      saving.value = false
    }
  }

  async function update(id: string, changes: RoleUpsert) {
    saving.value = true
    try {
      const { data, error } = await supabase
        .from('roles')
        .update(changes)
        .eq('id', id)
        .select()
        .single()

      if (error) throw new Error(toMessage(error))
      const index = roles.value.findIndex((role) => role.id === id)
      if (index !== -1) roles.value[index] = data as Role
      return data as Role
    } finally {
      saving.value = false
    }
  }

  async function remove(id: string) {
    saving.value = true
    try {
      const { error } = await supabase.from('roles').delete().eq('id', id)
      if (error) throw new Error(toMessage(error))
      roles.value = roles.value.filter((role) => role.id !== id)
      delete grants.value[id]
    } finally {
      saving.value = false
    }
  }

  /**
   * Replaces a role's grants with exactly `keys`. Sends only the difference,
   * so an unchanged checkbox costs nothing and the audit trail stays honest.
   */
  async function setPermissions(roleId: string, keys: string[]) {
    saving.value = true
    try {
      const current = new Set(grants.value[roleId] ?? [])
      const next = new Set(keys)

      const added = keys.filter((key) => !current.has(key))
      const removed = [...current].filter((key) => !next.has(key))

      if (added.length) {
        const { error } = await supabase
          .from('role_permissions')
          .insert(added.map((permission_key) => ({ role_id: roleId, permission_key })))
        if (error) throw new Error(toMessage(error))
      }

      if (removed.length) {
        const { error } = await supabase
          .from('role_permissions')
          .delete()
          .eq('role_id', roleId)
          .in('permission_key', removed)
        if (error) throw new Error(toMessage(error))
      }

      grants.value = { ...grants.value, [roleId]: keys }
    } finally {
      saving.value = false
    }
  }

  return {
    roles,
    permissions,
    grants,
    loading,
    saving,
    loaded,
    fetchAll,
    create,
    update,
    remove,
    setPermissions,
  }
})
