import { computed, reactive, watch } from 'vue'
import { useUsersStore } from '@/stores/users'
import { useRolesStore } from '@/stores/roles'
import { useAuthStore } from '@/stores/auth'
import { useAsyncAction } from './useAsyncAction'
import type { Profile } from '@/types'

/**
 * Draft state for one user being edited in a dialog. The draft stays local
 * until saved, so cancelling leaves the table untouched.
 */
export function useUserDetail(source: () => Profile | null) {
  const store = useUsersStore()
  const rolesStore = useRolesStore()
  const auth = useAuthStore()

  const draft = reactive<{ role_id: string | null; is_active: boolean }>({
    role_id: null,
    is_active: true,
  })

  watch(
    source,
    (user) => {
      if (!user) return
      draft.role_id = user.role_id
      draft.is_active = user.is_active
    },
    { immediate: true },
  )

  /** Roles the picker offers, highest rank first. */
  const roleOptions = computed(() =>
    rolesStore.roles.map((role) => ({
      value: role.id,
      title: role.label,
      subtitle: role.description ?? '',
    })),
  )

  const isSelf = computed(() => source()?.id === auth.user?.id)

  const dirty = computed(() => {
    const user = source()
    if (!user) return false
    return draft.role_id !== user.role_id || draft.is_active !== user.is_active
  })

  /** Guardrail mirrored by a database trigger: no self-promotion, no self-lockout. */
  const selfEditWarning = computed(() => {
    const user = source()
    if (!isSelf.value || !user) return null
    if (draft.role_id !== user.role_id) return 'You cannot change your own role.'
    if (!draft.is_active) return 'You cannot deactivate your own account.'
    return null
  })

  const canSave = computed(() => dirty.value && !selfEditWarning.value)

  const { loading, error, run } = useAsyncAction(
    async () => {
      const user = source()
      if (!user) return
      await store.update(user.id, { role_id: draft.role_id, is_active: draft.is_active })
    },
    { successMessage: 'User updated.' },
  )

  return {
    draft,
    roleOptions,
    dirty,
    canSave,
    isSelf,
    selfEditWarning,
    saving: loading,
    error,
    save: run,
  }
}
