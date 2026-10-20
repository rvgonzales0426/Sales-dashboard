import { computed, reactive, ref, watch } from 'vue'
import { useUsersStore } from '@/stores/users'
import { useRolesStore } from '@/stores/roles'
import { useAsyncAction } from './useAsyncAction'
import { DEFAULT_ROLE_KEY } from '@/config/roles'
import * as rules from './useValidation'

/** Admin > Users > Invite. Sends an invite through the Edge Function. */
export function useInviteForm(onDone: () => void) {
  const store = useUsersStore()
  const rolesStore = useRolesStore()

  const form = reactive({ email: '', fullName: '', roleKey: DEFAULT_ROLE_KEY as string })
  const valid = ref(false)

  /** The function resolves the role by key, so the picker sends keys. */
  const roleOptions = computed(() =>
    rolesStore.roles.map((role) => ({
      value: role.key,
      title: role.label,
      subtitle: role.description ?? '',
    })),
  )

  // Keep the default selection valid even if the 'user' role was relabelled.
  watch(
    () => rolesStore.roles,
    (roles) => {
      if (!roles.some((role) => role.key === form.roleKey)) {
        form.roleKey = roles.find((role) => role.key === DEFAULT_ROLE_KEY)?.key ?? roles[0]?.key
      }
    },
    { immediate: true },
  )

  const { loading, error, run } = useAsyncAction(
    async () => {
      await store.invite(form.email.trim(), form.roleKey, form.fullName.trim() || undefined)
      form.email = ''
      form.fullName = ''
      form.roleKey = DEFAULT_ROLE_KEY
      onDone()
    },
    { successMessage: 'Invite sent.', toastOnError: false },
  )

  async function submit() {
    if (!valid.value) return
    await run()
  }

  return {
    form,
    valid,
    roleOptions,
    sending: loading,
    error,
    submit,
    rules: {
      email: [rules.email],
      fullName: [rules.maxLength(80, 'Their name')],
    },
  }
}
