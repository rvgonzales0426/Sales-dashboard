import { computed, onMounted, ref } from 'vue'
import { useUploadsStore } from '@/stores/uploads'
import { useSalesStore } from '@/stores/sales'
import { useToast } from './useToast'
import { downloadFromUrl } from '@/lib/download'
import { quarterLabel } from '@/lib/format'
import type { Upload } from '@/types'

export interface PeriodHistory {
  key: string
  label: string
  versions: Upload[]
}

/** Upload history grouped by quarter, with restore and download-original. */
export function useUploadHistory() {
  const uploads = useUploadsStore()
  const sales = useSalesStore()
  const toast = useToast()

  const restoring = ref<Upload | null>(null)
  const busy = ref(false)

  const groups = computed<PeriodHistory[]>(() => {
    const byPeriod = new Map<string, PeriodHistory>()
    for (const upload of uploads.history) {
      const key = `${upload.period_year}-Q${upload.period_quarter}`
      const group = byPeriod.get(key) ?? { key, label: quarterLabel(upload.period_year, upload.period_quarter), versions: [] }
      group.versions.push(upload)
      byPeriod.set(key, group)
    }
    return [...byPeriod.values()]
  })

  async function load() {
    try {
      await uploads.fetchHistory()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load the upload history.')
    }
  }

  function askRestore(upload: Upload) {
    restoring.value = upload
  }

  async function confirmRestore() {
    if (!restoring.value) return
    busy.value = true
    const upload = restoring.value
    try {
      await uploads.restore(upload.id)
      await sales.invalidate()
      toast.success(`Version ${upload.version} is now the current ${quarterLabel(upload.period_year, upload.period_quarter)}.`)
      restoring.value = null
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'That version could not be restored.')
    } finally {
      busy.value = false
    }
  }

  async function download(upload: Upload) {
    try {
      downloadFromUrl(await uploads.downloadUrl(upload))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not download the original file.')
    }
  }

  onMounted(load)

  return {
    groups,
    loading: computed(() => uploads.loading),
    loaded: computed(() => uploads.loaded),
    restoring,
    busy,
    askRestore,
    confirmRestore,
    cancelRestore: () => (restoring.value = null),
    download,
    reload: load,
  }
}
