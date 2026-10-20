import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useUsersStore } from '@/stores/users'
import { useRolesStore } from '@/stores/roles'
import { useAuthStore } from '@/stores/auth'
import type { Profile } from '@/types'

type StatusFilter = 'all' | 'active' | 'inactive'

/**
 * List state for the user directory: loading, search, filters, and which
 * dialog is open. Editing a single user lives in useUserDetail.
 */
export function useUsers() {
  const store = useUsersStore()
  const rolesStore = useRolesStore()
  const auth = useAuthStore()
  const { items, loading, loaded } = storeToRefs(store)

  const search = ref('')
  /** Filters by role id, since roles are rows now rather than fixed names. */
  const roleFilter = ref<string | 'all'>('all')
  const statusFilter = ref<StatusFilter>('all')

  const editing = ref<Profile | null>(null)
  const inviteOpen = ref(false)

  const filtered = computed(() => {
    const term = search.value.trim().toLowerCase()
    return items.value.filter((user) => {
      if (roleFilter.value !== 'all' && user.role_id !== roleFilter.value) return false
      if (statusFilter.value === 'active' && !user.is_active) return false
      if (statusFilter.value === 'inactive' && user.is_active) return false
      if (!term) return true
      return (
        user.email.toLowerCase().includes(term) ||
        (user.full_name ?? '').toLowerCase().includes(term)
      )
    })
  })

  /** Filters hiding everything, with data underneath — the empty state for
   *  this case says something different from "no users yet". */
  const isFilteredEmpty = computed(() => filtered.value.length === 0 && items.value.length > 0)

  const hasFilters = computed(
    () => Boolean(search.value) || roleFilter.value !== 'all' || statusFilter.value !== 'all',
  )

  function clearFilters() {
    search.value = ''
    roleFilter.value = 'all'
    statusFilter.value = 'all'
  }

  async function ensureLoaded() {
    if (!loaded.value) await store.fetchAll()
    // The role filter and the edit dialog's picker both need the role list.
    if (!rolesStore.loaded) await rolesStore.fetchAll()
  }

  /** Options for the role filter, with an "all" entry in front. */
  const roleFilterItems = computed(() => [
    { value: 'all', title: 'All roles' },
    ...rolesStore.roles.map((role) => ({ value: role.id, title: role.label })),
  ])

  /** An admin cannot lock themselves out; the database enforces this too. */
  const isSelf = (user: Profile) => user.id === auth.user?.id

  return {
    items,
    loading,
    filtered,
    search,
    roleFilter,
    statusFilter,
    hasFilters,
    isFilteredEmpty,
    clearFilters,
    ensureLoaded,
    refresh: store.fetchAll,
    editing,
    inviteOpen,
    openEdit: (user: Profile) => (editing.value = user),
    closeEdit: () => (editing.value = null),
    isSelf,
    roleFilterItems,
  }
}
