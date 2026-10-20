import { onMounted, ref } from 'vue'
import type { ChartPoint } from './useAreaChart'

export interface DashboardStat {
  key: string
  label: string
  value: string
  delta?: string
  deltaLabel?: string
  upIsGood?: boolean
}

export interface ActivityEntry {
  id: string
  title: string
  detail: string
  at: string
}

/* ---------------------------------------------------------------------------
 * PLACEHOLDER DATA — REPLACE WITH PROJECT-SPECIFIC DATA
 *
 * Everything below is fake and exists only so the dashboard has something to
 * lay out. For a real project:
 *   1. Add a store, e.g. stores/inventory.ts, with the Supabase queries.
 *   2. Call its actions from here and delete the constants below.
 *   3. Keep the `loading` flag — the skeletons depend on it.
 * ------------------------------------------------------------------------- */

const PLACEHOLDER_STATS: DashboardStat[] = [
  { key: 'records', label: 'Total records', value: '1,284', delta: '+4.2%', deltaLabel: 'vs last month' },
  { key: 'active', label: 'Active this week', value: '312', delta: '+11.8%', deltaLabel: 'vs last week' },
  { key: 'pending', label: 'Pending review', value: '18', delta: '-6.0%', deltaLabel: 'vs last week', upIsGood: false },
  { key: 'members', label: 'Team members', value: '7' },
]

const PLACEHOLDER_SERIES: ChartPoint[] = [
  { label: 'Jan', value: 620 },
  { label: 'Feb', value: 684 },
  { label: 'Mar', value: 651 },
  { label: 'Apr', value: 742 },
  { label: 'May', value: 806 },
  { label: 'Jun', value: 779 },
  { label: 'Jul', value: 864 },
  { label: 'Aug', value: 921 },
  { label: 'Sep', value: 903 },
  { label: 'Oct', value: 988 },
  { label: 'Nov', value: 1046 },
  { label: 'Dec', value: 1128 },
]

const PLACEHOLDER_ACTIVITY: ActivityEntry[] = [
  { id: '1', title: 'Record #2041 approved', detail: 'by Alex Reyes', at: '20 minutes ago' },
  { id: '2', title: 'New member joined', detail: 'M. Santos accepted an invite', at: '2 hours ago' },
  { id: '3', title: 'Monthly report generated', detail: 'November summary', at: 'Yesterday' },
]

export function useDashboard() {
  const loading = ref(true)
  const stats = ref<DashboardStat[]>([])
  const series = ref<ChartPoint[]>([])
  const activity = ref<ActivityEntry[]>([])

  async function load() {
    loading.value = true
    // Replace this timeout with real store calls.
    await new Promise((resolve) => setTimeout(resolve, 550))
    stats.value = PLACEHOLDER_STATS
    series.value = PLACEHOLDER_SERIES
    activity.value = PLACEHOLDER_ACTIVITY
    loading.value = false
  }

  onMounted(load)

  return { loading, stats, series, activity, reload: load }
}
