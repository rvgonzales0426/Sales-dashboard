import { computed, reactive, ref, watch } from 'vue'
import { useRolesStore } from '@/stores/roles'
import { useAsyncAction } from './useAsyncAction'
import { CATEGORY_ORDER } from '@/config/permissions'
import * as rules from './useValidation'
import type { Permission, Role } from '@/types'

/** Turns a label into a usable key: "Stock Clerk" -> "stock_clerk". */
function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

/**
 * Draft state for one role — its details and its permission checkboxes.
 * Handles both editing an existing role and creating a new one; pass null.
 */
export function useRoleDetail(source: () => Role | null) {
  const store = useRolesStore()

  const form = reactive({ label: '', key: '', description: '', rank: 10 })
  const selected = ref<string[]>([])
  const valid = ref(false)
  /** Off once the user edits the key by hand, so we stop overwriting it. */
  const keyFollowsLabel = ref(true)

  const isNew = computed(() => source() === null)
  const isSystem = computed(() => source()?.is_system ?? false)
  const isSuperuser = computed(() => source()?.is_superuser ?? false)

  watch(
    source,
    (role) => {
      form.label = role?.label ?? ''
      form.key = role?.key ?? ''
      form.description = role?.description ?? ''
      form.rank = role?.rank ?? 10
      // A superuser role has no grant rows — it holds everything implicitly.
      // Show every box ticked so the dialog tells the truth; it is read-only.
      selected.value = role?.is_superuser
        ? store.permissions.map((permission) => permission.key)
        : role
          ? [...(store.grants[role.id] ?? [])]
          : []
      keyFollowsLabel.value = role === null
    },
    { immediate: true },
  )

  watch(
    () => form.label,
    (label) => {
      if (keyFollowsLabel.value) form.key = slugify(label)
    },
  )

  /** Permissions grouped for the editor, in a deliberate category order. */
  const groups = computed(() => {
    const byCategory = new Map<string, Permission[]>()
    for (const permission of store.permissions) {
      const list = byCategory.get(permission.category) ?? []
      list.push(permission)
      byCategory.set(permission.category, list)
    }

    const order = CATEGORY_ORDER as readonly string[]
    return [...byCategory.entries()]
      .sort(([a], [b]) => {
        const indexA = order.indexOf(a)
        const indexB = order.indexOf(b)
        if (indexA !== -1 || indexB !== -1) {
          return (indexA === -1 ? order.length : indexA) - (indexB === -1 ? order.length : indexB)
        }
        return a.localeCompare(b)
      })
      .map(([category, items]) => ({ category, items }))
  })

  const dirty = computed(() => {
    const role = source()
    if (!role) return form.label.trim().length > 0
    const current = [...(store.grants[role.id] ?? [])].sort().join(',')
    return (
      form.label !== role.label ||
      form.description !== (role.description ?? '') ||
      form.rank !== role.rank ||
      [...selected.value].sort().join(',') !== current
    )
  })

  const canSave = computed(() => valid.value && dirty.value)

  const { loading: saving, error, run } = useAsyncAction(
    async () => {
      const role = source()
      const details = {
        label: form.label.trim(),
        description: form.description.trim() || null,
        rank: form.rank,
      }

      const target = role
        ? await store.update(role.id, details)
        : await store.create({ ...details, key: form.key })

      // A superuser role holds everything implicitly; the database rejects
      // grant rows for it, so don't try.
      if (target && !target.is_superuser) {
        await store.setPermissions(target.id, selected.value)
      }
    },
    { successMessage: 'Role saved.', toastOnError: false },
  )

  function toggleCategory(category: string, on: boolean) {
    const keys = groups.value.find((group) => group.category === category)?.items ?? []
    const others = selected.value.filter((key) => !keys.some((item) => item.key === key))
    selected.value = on ? [...others, ...keys.map((item) => item.key)] : others
  }

  return {
    form,
    selected,
    valid,
    groups,
    isNew,
    isSystem,
    isSuperuser,
    dirty,
    canSave,
    saving,
    error,
    save: run,
    toggleCategory,
    onKeyEdited: () => (keyFollowsLabel.value = false),
    rules: {
      label: [rules.required('A name'), rules.maxLength(40, 'The name')],
      key: [
        rules.required('A key'),
        (value: unknown) =>
          /^[a-z][a-z0-9_]*$/.test(String(value)) ||
          'Use lowercase letters, numbers and underscores, starting with a letter.',
      ],
    },
  }
}
