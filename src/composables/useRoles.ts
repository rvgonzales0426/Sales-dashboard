import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRolesStore } from '@/stores/roles'
import { useUsersStore } from '@/stores/users'
import { useAsyncAction } from './useAsyncAction'
import type { Role } from '@/types'

/**
 * List state for the roles page: loading, search, and which dialog is open.
 * Editing one role's permissions lives in useRoleDetail.
 */
export function useRoles() {
  const store = useRolesStore()
  const usersStore = useUsersStore()
  const { roles, permissions, grants, loading, loaded } = storeToRefs(store)

  const search = ref('')
  const editing = ref<Role | null>(null)
  const creating = ref(false)
  const confirmingDelete = ref<Role | null>(null)

  const filtered = computed(() => {
    const term = search.value.trim().toLowerCase()
    if (!term) return roles.value
    return roles.value.filter(
      (role) =>
        role.label.toLowerCase().includes(term) ||
        role.key.toLowerCase().includes(term) ||
        (role.description ?? '').toLowerCase().includes(term),
    )
  })

  /** How many permissions each role holds — superusers hold all of them. */
  function permissionCount(role: Role): number {
    if (role.is_superuser) return permissions.value.length
    return grants.value[role.id]?.length ?? 0
  }

  /** How many people currently hold a role, so deleting one is an informed act. */
  function memberCount(role: Role): number {
    return usersStore.items.filter((user) => user.role_id === role.id).length
  }

  async function ensureLoaded() {
    if (!loaded.value) await store.fetchAll()
    // Needed for the member counts; harmless if the caller lacks users.read,
    // because RLS simply returns nothing.
    if (!usersStore.loaded) await usersStore.fetchAll().catch(() => undefined)
  }

  const { loading: deleting, error: deleteError, run: confirmDelete } = useAsyncAction(
    async (role: Role) => {
      await store.remove(role.id)
      confirmingDelete.value = null
    },
    { successMessage: 'Role deleted.' },
  )

  return {
    roles,
    permissions,
    filtered,
    loading,
    search,
    editing,
    creating,
    confirmingDelete,
    deleting,
    deleteError,
    confirmDelete,
    ensureLoaded,
    refresh: store.fetchAll,
    permissionCount,
    memberCount,
    openEdit: (role: Role) => (editing.value = role),
    closeEdit: () => (editing.value = null),
  }
}
