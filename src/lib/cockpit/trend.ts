/** One line on a trend chart. */
export interface TrendSeries {
  key: string
  label: string
  /** Theme colour name, e.g. 'area-north' or 'ink'. */
  color: string
  values: (number | null)[]
}
