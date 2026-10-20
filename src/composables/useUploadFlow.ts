import { computed, ref, shallowRef, watch } from 'vue'
import {
  buildCommitPayload,
  canCommit,
  checkFileMeta,
  diffUpload,
  errorsIn,
  failedResult,
  parseWorkbook,
  sha256Hex,
  type KnownPerson,
  type ParseResult,
  type SnapshotPerson,
} from '@/lib/excel'
import { useUploadsStore } from '@/stores/uploads'
import { useSalesStore } from '@/stores/sales'
import type { Upload } from '@/types'

export type UploadStep = 'idle' | 'reading' | 'preview' | 'committing' | 'done'

/**
 * The upload, start to finish:
 *
 *   choose file → parse in the browser → preview (problems, diff, year)
 *     → store the original → commit_upload() re-validates and writes
 *     → the cockpit refreshes
 *
 * Nothing touches the database until the person presses Save.
 */
export function useUploadFlow() {
  const uploads = useUploadsStore()
  const sales = useSalesStore()

  const step = ref<UploadStep>('idle')
  const file = shallowRef<File | null>(null)
  const bytes = shallowRef<ArrayBuffer | null>(null)
  const result = shallowRef<ParseResult | null>(null)
  const year = ref<number>(new Date().getFullYear())
  const matches = ref<Record<string, string>>({})
  const previous = shallowRef<{ upload: Upload; people: SnapshotPerson[] } | null>(null)
  const known = shallowRef<KnownPerson[]>([])
  const loadingPrevious = ref(false)
  const error = ref<string | null>(null)
  const committed = shallowRef<Upload | null>(null)

  const yearValid = computed(() => Number.isInteger(year.value) && year.value >= 2000 && year.value <= 2100)

  const diff = computed(() => {
    if (!result.value?.people.length || !result.value.calendarMonths) return null
    return diffUpload(result.value.people, previous.value?.people ?? null, known.value, result.value.calendarMonths, matches.value)
  })

  const blockers = computed<string[]>(() => {
    if (!result.value) return []
    const reasons = errorsIn(result.value).map((issue) => issue.message)
    if (!yearValid.value) reasons.push('Enter the year this quarter belongs to (2000 to 2100).')
    return reasons
  })

  const ready = computed(
    () => step.value === 'preview' && !!result.value && canCommit(result.value) && yearValid.value && !loadingPrevious.value,
  )

  async function loadPrevious() {
    const quarter = result.value?.quarter
    if (!quarter || !yearValid.value) {
      previous.value = null
      return
    }
    loadingPrevious.value = true
    try {
      const [snapshot, people] = await Promise.all([
        uploads.fetchCurrentSnapshot(year.value, quarter),
        known.value.length ? Promise.resolve(known.value) : uploads.fetchKnownPeople(),
      ])
      previous.value = snapshot
      known.value = people
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Could not load the current version to compare against.'
    } finally {
      loadingPrevious.value = false
    }
  }

  // The diff compares against the same quarter of whichever year is chosen.
  watch(year, () => {
    if (step.value === 'preview') loadPrevious()
  })

  async function select(chosen: File) {
    reset()
    file.value = chosen
    const meta = { fileName: chosen.name, fileSize: chosen.size }
    step.value = 'reading'
    try {
      // Too big or empty: say so without reading the file into memory.
      const sizeProblem = checkFileMeta(chosen.name, chosen.size)
      let parsed: ParseResult
      if (sizeProblem && (sizeProblem.code === 'file_too_large' || sizeProblem.code === 'file_empty')) {
        parsed = failedResult(meta, sizeProblem)
      } else {
        bytes.value = await chosen.arrayBuffer()
        parsed = await parseWorkbook(bytes.value, meta)
      }
      result.value = parsed
      year.value = parsed.suggestedYear
      step.value = 'preview'
      if (!parsed.fatal) await loadPrevious()
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'The file could not be read.'
      step.value = 'idle'
    }
  }

  function match(nameKey: string, personId: string | null) {
    const next = { ...matches.value }
    if (personId) next[nameKey] = personId
    else delete next[nameKey]
    matches.value = next
  }

  async function commit(): Promise<Upload | null> {
    if (!ready.value || !result.value || !file.value || !bytes.value) return null
    step.value = 'committing'
    error.value = null
    try {
      const sha256 = await sha256Hex(bytes.value)
      const filePath = await uploads.storeFile(file.value, year.value, result.value.quarter!)
      const payload = buildCommitPayload(result.value, { year: year.value, filePath, sha256, matches: matches.value })
      committed.value = await uploads.commit(payload)
      // This tab updates now; other tabs and wall displays hear it over Realtime.
      await sales.invalidate()
      step.value = 'done'
      return committed.value
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'The upload could not be saved.'
      step.value = 'preview'
      return null
    }
  }

  function reset() {
    step.value = 'idle'
    file.value = null
    bytes.value = null
    result.value = null
    matches.value = {}
    previous.value = null
    error.value = null
    committed.value = null
  }

  return {
    step,
    file,
    result,
    year,
    yearValid,
    matches,
    previous,
    loadingPrevious,
    diff,
    blockers,
    ready,
    error,
    committed,
    select,
    match,
    commit,
    reset,
  }
}
