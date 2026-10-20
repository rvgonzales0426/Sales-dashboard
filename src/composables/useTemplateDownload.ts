import { computed, ref } from 'vue'
import { buildTemplate, manilaToday, templateFileName, XLSX_MIME, type TemplatePerson } from '@/lib/excel'
import { resolveTargets } from '@/lib/metrics'
import { saveFile } from '@/lib/download'
import { useSalesStore } from '@/stores/sales'
import { useToast } from './useToast'

/**
 * "Download blank template": the exact layout the importer expects, for the
 * current quarter. Optionally pre-filled with the latest roster and each
 * person's effective targets, so only the month figures are left to type.
 */
export function useTemplateDownload() {
  const sales = useSalesStore()
  const toast = useToast()
  const busy = ref(false)

  const today = manilaToday()
  const quarter = today.quarter
  const year = today.year
  const rosterSource = computed(() => sales.latest)

  async function roster(): Promise<TemplatePerson[]> {
    const latest = rosterSource.value
    if (!latest) return []
    const data = await sales.loadPeriod(latest.year, latest.quarter)
    if (!data) return []
    return data.people
      .map((person) => ({
        lastName: person.lastName,
        firstName: person.firstName,
        position: person.position,
        area: person.area,
        targets: resolveTargets(person, data.adminTargets, sales.settings).values,
      }))
      .sort((a, b) => a.position.localeCompare(b.position) || a.lastName.localeCompare(b.lastName))
  }

  async function download(withRoster: boolean) {
    busy.value = true
    try {
      const people = withRoster ? await roster() : []
      const data = await buildTemplate({ quarter, roster: people })
      saveFile(data, templateFileName(quarter, year), XLSX_MIME)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not build the template.')
    } finally {
      busy.value = false
    }
  }

  return { busy, quarter, year, rosterSource, download }
}
