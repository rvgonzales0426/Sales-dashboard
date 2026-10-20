import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase, toMessage } from '@/lib/supabase'
import {
  DEFAULT_SETTINGS,
  toAdminTargets,
  toMetricSettings,
  toPersonPeriods,
  type AdminTarget,
  type MetricSettings,
  type PersonPeriod,
} from '@/lib/metrics'
import type { PerformanceRow, Person, Quarter, QuarterMonth, SalesSettings, TargetRow, Upload, UploadPerson } from '@/types'

export interface PeriodSummary {
  uploadId: string
  year: number
  quarter: Quarter
  version: number
  monthsWithData: QuarterMonth[]
  uploadedAt: string
}

export interface PeriodData {
  key: string
  summary: PeriodSummary
  people: PersonPeriod[]
  adminTargets: AdminTarget[]
  targetRows: TargetRow[]
}

export const periodKey = (year: number, quarter: number) => `${year}-Q${quarter}`

export function parsePeriodKey(key: string | null | undefined): { year: number; quarter: Quarter } | null {
  const match = /^(\d{4})-Q([1-4])$/.exec(key ?? '')
  return match ? { year: Number(match[1]), quarter: Number(match[2]) as Quarter } : null
}

/**
 * Everything the cockpit reads: which quarters exist, each quarter's current
 * snapshot, admin targets and settings. Commits, restores and target edits —
 * from this tab or any other — arrive over Realtime and bump `revision`, which
 * views watch to recompute without a page reload.
 */
export const useSalesStore = defineStore('sales', () => {
  const periods = ref<PeriodSummary[]>([])
  const periodsLoaded = ref(false)
  const cache = ref<Record<string, PeriodData>>({})
  const settingsRow = ref<SalesSettings | null>(null)
  const loading = ref(false)
  const revision = ref(0)
  /** Cached snapshots that are known current; the rest are shown while they refetch. */
  const fresh = new Set<string>()
  let stale = false
  let channel: RealtimeChannel | null = null
  let debounce: ReturnType<typeof setTimeout> | null = null

  const latest = computed(() => periods.value[0] ?? null)
  const settings = computed<MetricSettings>(() =>
    settingsRow.value ? toMetricSettings(settingsRow.value) : DEFAULT_SETTINGS,
  )
  const wallRotateSeconds = computed(() => settingsRow.value?.wall_rotate_seconds ?? 20)

  async function fetchPeriods() {
    const { data, error } = await supabase
      .from('uploads')
      .select('id, period_year, period_quarter, version, months_with_data, uploaded_at')
      .eq('is_current', true)
      .order('period_year', { ascending: false })
      .order('period_quarter', { ascending: false })
    if (error) throw new Error(toMessage(error))
    periods.value = (data as Upload[]).map((u) => ({
      uploadId: u.id,
      year: u.period_year,
      quarter: u.period_quarter,
      version: u.version,
      monthsWithData: [...u.months_with_data].sort() as QuarterMonth[],
      uploadedAt: u.uploaded_at,
    }))
    periodsLoaded.value = true
  }

  async function fetchSettings() {
    const { data, error } = await supabase.from('app_settings').select('*').maybeSingle()
    if (error) throw new Error(toMessage(error))
    settingsRow.value = (data as SalesSettings | null) ?? null
  }

  async function fetchTargets(year: number, quarter: Quarter): Promise<TargetRow[]> {
    const { data, error } = await supabase
      .from('targets')
      .select('*')
      .eq('period_year', year)
      .eq('period_quarter', quarter)
    if (error) throw new Error(toMessage(error))
    return (data ?? []) as TargetRow[]
  }

  /** A quarter already in memory, synchronously — lets a view paint before any await. */
  function peek(year: number, quarter: Quarter): PeriodData | null {
    return cache.value[periodKey(year, quarter)] ?? null
  }

  async function loadPeriod(year: number, quarter: Quarter, options: { force?: boolean } = {}): Promise<PeriodData | null> {
    const key = periodKey(year, quarter)
    // After invalidate() the cache is kept for display but no longer trusted.
    if (stale) {
      stale = false
      fresh.clear()
    }
    if (!options.force && cache.value[key] && fresh.has(key)) return cache.value[key]
    if (!periodsLoaded.value) await fetchPeriods()
    const summary = periods.value.find((p) => p.year === year && p.quarter === quarter)
    if (!summary) return null

    loading.value = true
    try {
      const [members, rows, targetRows] = await Promise.all([
        supabase.from('upload_people').select('*').eq('upload_id', summary.uploadId),
        supabase.from('performance_rows').select('*').eq('upload_id', summary.uploadId),
        fetchTargets(year, quarter),
      ])
      if (members.error) throw new Error(toMessage(members.error))
      if (rows.error) throw new Error(toMessage(rows.error))

      const memberRows = members.data as UploadPerson[]
      const ids = memberRows.map((m) => m.person_id)
      const people = ids.length
        ? await supabase.from('people').select('id, last_name, first_name').in('id', ids)
        : { data: [], error: null }
      if (people.error) throw new Error(toMessage(people.error))
      const names = new Map((people.data as Pick<Person, 'id' | 'last_name' | 'first_name'>[]).map((p) => [p.id, p]))

      const data: PeriodData = {
        key,
        summary,
        people: toPersonPeriods(memberRows, rows.data as PerformanceRow[], names),
        adminTargets: toAdminTargets(targetRows),
        targetRows,
      }
      cache.value = { ...cache.value, [key]: data }
      fresh.add(key)
      return data
    } finally {
      loading.value = false
    }
  }

  /** Every current quarter, for quarter-over-quarter trends. Small data; loads in parallel. */
  async function loadAllPeriods(): Promise<PeriodData[]> {
    if (!periodsLoaded.value) await fetchPeriods()
    const loaded = await Promise.all(periods.value.map((p) => loadPeriod(p.year, p.quarter)))
    return loaded.filter((p): p is PeriodData => p !== null)
  }

  /** Drop cached snapshots and tell every view to recompute. */
  async function invalidate() {
    stale = true
    await Promise.all([fetchPeriods(), fetchSettings()])
    revision.value++
  }

  async function initialize() {
    await Promise.all([periodsLoaded.value ? null : fetchPeriods(), settingsRow.value ? null : fetchSettings()])
    subscribe()
  }

  function subscribe() {
    if (channel) return
    const refresh = () => {
      // A commit is an insert plus an is_current flip; coalesce them.
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => {
        invalidate().catch((error) => console.error('[sales] Could not refresh after a change.', error))
      }, 300)
    }
    channel = supabase
      .channel('cockpit-uploads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'uploads' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'targets' }, refresh)
      .subscribe()
  }

  async function unsubscribe() {
    if (channel) await supabase.removeChannel(channel)
    channel = null
  }

  async function updateSettings(changes: Partial<SalesSettings>) {
    const { data, error } = await supabase
      .from('app_settings')
      .update(changes)
      .eq('id', true)
      .select('*')
      .single()
    if (error) throw new Error(toMessage(error))
    settingsRow.value = data as SalesSettings
    revision.value++
    return settingsRow.value
  }

  /** The sales person linked to this sign-in, for agent self-view. */
  async function myPersonId(): Promise<string | null> {
    const { data, error } = await supabase.rpc('my_person_id')
    if (error) throw new Error(toMessage(error))
    return (data as string | null) ?? null
  }

  function reset() {
    periods.value = []
    periodsLoaded.value = false
    cache.value = {}
    fresh.clear()
    settingsRow.value = null
  }

  return {
    periods,
    periodsLoaded,
    latest,
    settings,
    settingsRow,
    wallRotateSeconds,
    loading,
    revision,
    initialize,
    fetchPeriods,
    fetchSettings,
    loadPeriod,
    peek,
    loadAllPeriods,
    invalidate,
    subscribe,
    unsubscribe,
    updateSettings,
    myPersonId,
    reset,
  }
})
