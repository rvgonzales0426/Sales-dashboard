import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase, toMessage } from '@/lib/supabase'
import { toCentavos } from '@/lib/metrics/money'
import { XLSX_MIME, type CommitPayload, type KnownPerson, type SnapshotPerson } from '@/lib/excel'
import type { PerformanceRow, Person, Quarter, Upload, UploadPerson } from '@/types'

const HISTORY_SELECT = '*, uploader:profiles(full_name, email)'
const BUCKET = 'workbooks'

const cents = (value: number | null) => (value === null ? null : toCentavos(value))

/**
 * Workbook uploads: the file in Storage, the snapshot through commit_upload(),
 * history, restore, and the reads the preview's diff needs. Writes are gated by
 * uploads.write in Postgres; this store only asks.
 */
export const useUploadsStore = defineStore('uploads', () => {
  const history = ref<Upload[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  async function fetchHistory() {
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('uploads')
        .select(HISTORY_SELECT)
        .order('period_year', { ascending: false })
        .order('period_quarter', { ascending: false })
        .order('version', { ascending: false })
      if (error) throw new Error(toMessage(error))
      history.value = (data ?? []) as Upload[]
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  /** The current version of a quarter, as the diff wants it. Null when the quarter is new. */
  async function fetchCurrentSnapshot(year: number, quarter: Quarter): Promise<{ upload: Upload; people: SnapshotPerson[] } | null> {
    const { data: upload, error } = await supabase
      .from('uploads')
      .select('*')
      .eq('period_year', year)
      .eq('period_quarter', quarter)
      .eq('is_current', true)
      .maybeSingle()
    if (error) throw new Error(toMessage(error))
    if (!upload) return null

    const [members, rows, people] = await Promise.all([
      supabase.from('upload_people').select('*').eq('upload_id', upload.id),
      supabase.from('performance_rows').select('*').eq('upload_id', upload.id),
      supabase.from('people').select('id, last_name, first_name'),
    ])
    for (const result of [members, rows, people]) {
      if (result.error) throw new Error(toMessage(result.error))
    }
    const names = new Map((people.data as Pick<Person, 'id' | 'last_name' | 'first_name'>[]).map((p) => [p.id, p]))
    const byPerson = new Map<string, PerformanceRow[]>()
    for (const row of rows.data as PerformanceRow[]) {
      byPerson.set(row.person_id, [...(byPerson.get(row.person_id) ?? []), row])
    }

    return {
      upload: upload as Upload,
      people: (members.data as UploadPerson[]).map((m) => ({
        personId: m.person_id,
        lastName: names.get(m.person_id)?.last_name ?? m.source_last_name,
        firstName: names.get(m.person_id)?.first_name ?? m.source_first_name,
        position: m.position,
        area: m.area,
        months: Object.fromEntries(
          (byPerson.get(m.person_id) ?? []).map((r) => [
            r.month,
            { inhouse: toCentavos(r.inhouse), ethical: toCentavos(r.ethical), calls: r.calls },
          ]),
        ),
        targets: {
          inhouse: cents(m.target_inhouse),
          ethical: cents(m.target_ethical),
          combi: cents(m.target_combi),
          calls: m.target_calls,
        },
      })),
    }
  }

  /** Everyone the system knows, with remembered spellings, for name matching. */
  async function fetchKnownPeople(): Promise<KnownPerson[]> {
    const [people, aliases] = await Promise.all([
      supabase.from('people').select('id, name_key, last_name, first_name, merged_into'),
      supabase.from('person_aliases').select('name_key, person_id'),
    ])
    if (people.error) throw new Error(toMessage(people.error))
    if (aliases.error) throw new Error(toMessage(aliases.error))
    const aliasesOf = new Map<string, string[]>()
    for (const alias of aliases.data as { name_key: string; person_id: string }[]) {
      aliasesOf.set(alias.person_id, [...(aliasesOf.get(alias.person_id) ?? []), alias.name_key])
    }
    return (people.data as Pick<Person, 'id' | 'name_key' | 'last_name' | 'first_name' | 'merged_into'>[])
      .filter((p) => !p.merged_into)
      .map((p) => ({
        id: p.id,
        nameKey: p.name_key,
        lastName: p.last_name,
        firstName: p.first_name,
        aliases: aliasesOf.get(p.id) ?? [],
      }))
  }

  /** Puts the original .xlsx in Storage first; commit_upload() checks it is there. */
  async function storeFile(file: File, year: number, quarter: Quarter): Promise<string> {
    const path = `${year}-Q${quarter}/${crypto.randomUUID()}.xlsx`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: XLSX_MIME,
      upsert: false,
    })
    if (error) throw new Error(toMessage(error, 'Could not store the workbook. Check your connection and try again.'))
    return path
  }

  async function commit(payload: CommitPayload): Promise<Upload> {
    const { data, error } = await supabase.rpc('commit_upload', { payload })
    if (error) throw new Error(toMessage(error, 'The upload could not be saved.'))
    const upload = data as Upload
    if (loaded.value) await fetchHistory()
    return upload
  }

  async function restore(uploadId: string): Promise<Upload> {
    const { data, error } = await supabase.rpc('restore_upload', { p_upload_id: uploadId })
    if (error) throw new Error(toMessage(error, 'That version could not be restored.'))
    await fetchHistory()
    return data as Upload
  }

  /** A short-lived link that downloads the original file under its original name. */
  async function downloadUrl(upload: Upload): Promise<string> {
    if (!upload.file_path) throw new Error('This version was seeded, so there is no original file.')
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(upload.file_path, 60, { download: upload.original_filename })
    if (error) throw new Error(toMessage(error, 'Could not prepare the download.'))
    return data.signedUrl
  }

  return {
    history,
    loading,
    loaded,
    fetchHistory,
    fetchCurrentSnapshot,
    fetchKnownPeople,
    storeFile,
    commit,
    restore,
    downloadUrl,
  }
})
