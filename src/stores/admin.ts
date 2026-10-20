import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase, toMessage } from '@/lib/supabase'
import type { AuditEntry, Person, PersonUpdate, Profile, Quarter, TargetRow, TargetUpsert } from '@/types'

export interface PersonWithLinks extends Person {
  aliases: string[]
  profile: Pick<Profile, 'id' | 'email' | 'full_name'> | null
}

/**
 * Sales administration: targets, people (edit, merge, link to an account) and
 * the audit log. Every write is gated in Postgres — targets.write,
 * people.write, audit.read — and target edits audit themselves by trigger.
 */
export const useAdminStore = defineStore('sales-admin', () => {
  const people = ref<PersonWithLinks[]>([])
  const peopleLoaded = ref(false)
  const audit = ref<AuditEntry[]>([])
  const auditHasMore = ref(false)
  const busy = ref(false)

  /* ---- targets --------------------------------------------------------- */

  async function fetchTargets(year: number, quarter: Quarter): Promise<TargetRow[]> {
    const { data, error } = await supabase.from('targets').select('*').eq('period_year', year).eq('period_quarter', quarter)
    if (error) throw new Error(toMessage(error))
    return (data ?? []) as TargetRow[]
  }

  /** Insert or update by id. Blank fields mean "inherit", so an all-blank override is deleted instead. */
  async function saveTarget(target: TargetUpsert): Promise<TargetRow | null> {
    busy.value = true
    try {
      const values = [target.inhouse, target.ethical, target.combi, target.calls]
      if (values.every((v) => v === null)) {
        if (target.id) await removeTarget(target.id)
        return null
      }
      const { id, ...row } = target
      const query = id
        ? supabase.from('targets').update(row).eq('id', id).select('*').single()
        : supabase.from('targets').insert(row).select('*').single()
      const { data, error } = await query
      if (error) throw new Error(toMessage(error))
      return data as TargetRow
    } finally {
      busy.value = false
    }
  }

  async function removeTarget(id: string) {
    const { error } = await supabase.from('targets').delete().eq('id', id)
    if (error) throw new Error(toMessage(error))
  }

  /* ---- people ---------------------------------------------------------- */

  async function fetchPeople() {
    const [rows, aliases] = await Promise.all([
      supabase.from('people').select('*, profile:profiles(id, email, full_name)').order('last_name'),
      supabase.from('person_aliases').select('name_key, person_id'),
    ])
    if (rows.error) throw new Error(toMessage(rows.error))
    if (aliases.error) throw new Error(toMessage(aliases.error))
    const byPerson = new Map<string, string[]>()
    for (const a of aliases.data as { name_key: string; person_id: string }[]) {
      byPerson.set(a.person_id, [...(byPerson.get(a.person_id) ?? []), a.name_key])
    }
    people.value = (rows.data as (Person & { profile: PersonWithLinks['profile'] })[]).map((p) => ({
      ...p,
      aliases: byPerson.get(p.id) ?? [],
    }))
    peopleLoaded.value = true
  }

  async function updatePerson(id: string, changes: PersonUpdate) {
    busy.value = true
    try {
      const { error } = await supabase.from('people').update(changes).eq('id', id)
      if (error) throw new Error(toMessage(error))
      await fetchPeople()
    } finally {
      busy.value = false
    }
  }

  async function mergePeople(keepId: string, mergeId: string) {
    busy.value = true
    try {
      const { error } = await supabase.rpc('merge_people', { p_keep: keepId, p_merge: mergeId })
      if (error) throw new Error(toMessage(error))
      await fetchPeople()
    } finally {
      busy.value = false
    }
  }

  /** Accounts that could be linked to a person for agent self-view. */
  async function fetchProfiles(): Promise<Pick<Profile, 'id' | 'email' | 'full_name'>[]> {
    const { data, error } = await supabase.from('profiles').select('id, email, full_name').order('email')
    if (error) throw new Error(toMessage(error))
    return data ?? []
  }

  /* ---- audit ----------------------------------------------------------- */

  const PAGE = 50

  async function fetchAudit(options: { action?: string; reset?: boolean } = {}) {
    const offset = options.reset ? 0 : audit.value.length
    let query = supabase.from('audit_log').select('*').order('at', { ascending: false }).range(offset, offset + PAGE)
    if (options.action) query = query.like('action', `${options.action}%`)
    const { data, error } = await query
    if (error) throw new Error(toMessage(error))
    const rows = (data ?? []) as AuditEntry[]
    auditHasMore.value = rows.length > PAGE
    const page = rows.slice(0, PAGE)
    audit.value = options.reset ? page : [...audit.value, ...page]
  }

  return {
    people,
    peopleLoaded,
    audit,
    auditHasMore,
    busy,
    fetchTargets,
    saveTarget,
    removeTarget,
    fetchPeople,
    updatePerson,
    mergePeople,
    fetchProfiles,
    fetchAudit,
  }
})
