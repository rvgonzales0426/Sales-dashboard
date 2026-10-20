import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase, toMessage } from '@/lib/supabase'
import type { Profile, ProfileAdminUpdate } from '@/types'

/** Selects each profile together with its role row in one round trip. */
const PROFILE_SELECT = '*, role:roles(*)'

/**
 * Admin-side user directory. Every read and write here is gated by RLS on the
 * server (users.read / users.write), so someone without the permission gets an
 * empty list or a permission error rather than data.
 */
export const useUsersStore = defineStore('users', () => {
  const items = ref<Profile[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const loaded = ref(false)

  async function fetchAll() {
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_SELECT)
        .order('created_at', { ascending: false })

      if (error) throw new Error(toMessage(error))
      items.value = (data ?? []) as Profile[]
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  function replaceLocal(updated: Profile) {
    const index = items.value.findIndex((item) => item.id === updated.id)
    if (index !== -1) items.value[index] = updated
  }

  async function update(id: string, changes: ProfileAdminUpdate) {
    saving.value = true
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(changes)
        .eq('id', id)
        .select(PROFILE_SELECT)
        .single()

      if (error) throw new Error(toMessage(error))
      replaceLocal(data as Profile)
      return data as Profile
    } finally {
      saving.value = false
    }
  }

  const setRole = (id: string, role_id: string | null) => update(id, { role_id })
  const setActive = (id: string, is_active: boolean) => update(id, { is_active })

  /**
   * Inviting requires the service-role key, which must never reach the browser,
   * so it runs in an Edge Function. Deploy it with:
   *   supabase functions deploy invite-user
   * See supabase/functions/invite-user/index.ts.
   */
  async function invite(email: string, roleKey: string, fullName?: string) {
    saving.value = true
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email, role_key: roleKey, full_name: fullName ?? null },
      })
      if (error) {
        throw new Error(
          toMessage(error, 'Could not send the invite. Is the invite-user function deployed?'),
        )
      }
      await fetchAll()
      return data
    } finally {
      saving.value = false
    }
  }

  return { items, loading, saving, loaded, fetchAll, update, setRole, setActive, invite }
})
