import { AREA_LABEL, ROLE_LABEL } from '@/lib/cockpit/filters'
import { PACE_LABEL, toPesos, type PersonMetrics, type Ranked } from '@/lib/metrics'

/* ---------------------------------------------------------------------------
 * Leaderboard exports for management reports. One row model feeds both CSV
 * and PDF, so the two never disagree.
 * ------------------------------------------------------------------------- */

export interface LeaderboardRow {
  rank: number | null
  name: string
  area: string
  position: string
  combi: number
  inhouse: number
  ethical: number
  calls: number
  combiPct: number | null
  pace: string
}

export function toRows(ranked: readonly Ranked<PersonMetrics>[]): LeaderboardRow[] {
  return ranked.map(({ item, rank }) => ({
    rank,
    name: `${item.lastName}, ${item.firstName}`,
    area: AREA_LABEL[item.area],
    position: ROLE_LABEL[item.position],
    combi: item.actual.combi,
    inhouse: item.actual.inhouse,
    ethical: item.actual.ethical,
    calls: item.actual.calls,
    combiPct: item.attainment.combi,
    pace: PACE_LABEL[item.pace.status],
  }))
}

const HEADERS = ['Rank', 'Name', 'Area', 'Position', 'Combi (PHP)', 'In-house (PHP)', 'Ethical (PHP)', 'Calls', 'Combi attainment %', 'Pace']

/** RFC 4180: quote fields with commas, quotes or line breaks; double inner quotes. */
function field(value: string | number | null): string {
  if (value === null) return ''
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * CSV a spreadsheet opens cleanly: a UTF-8 BOM so Excel reads "ñ" right,
 * amounts as plain numbers with two decimals (no ₱, no thousands separators)
 * so they stay numbers, attainment as a percentage with one decimal.
 */
export function leaderboardCsv(rows: readonly LeaderboardRow[]): string {
  const lines = [HEADERS.map(field).join(',')]
  for (const row of rows) {
    lines.push(
      [
        row.rank ?? '',
        row.name,
        row.area,
        row.position,
        toPesos(row.combi).toFixed(2),
        toPesos(row.inhouse).toFixed(2),
        toPesos(row.ethical).toFixed(2),
        row.calls,
        row.combiPct === null ? '' : (row.combiPct * 100).toFixed(1),
        row.pace,
      ]
        .map((v) => field(v as string | number))
        .join(','),
    )
  }
  return `﻿${lines.join('\r\n')}\r\n`
}

const pdfMoney = (centavos: number) =>
  `PHP ${toPesos(centavos).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * A one-page-wide PDF of the same rows. jsPDF's built-in fonts have no ₱, so
 * amounts read "PHP 1,234.00" here rather than print a missing glyph.
 */
export async function leaderboardPdf(rows: readonly LeaderboardRow[], title: string, subtitle: string): Promise<ArrayBuffer> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(title, 40, 44)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(90)
  doc.text(subtitle, 40, 62)
  autoTable(doc, {
    startY: 78,
    head: [HEADERS.map((h) => h.replace(' (PHP)', ''))],
    body: rows.map((r) => [
      r.rank ?? '—',
      r.name,
      r.area,
      r.position,
      pdfMoney(r.combi),
      pdfMoney(r.inhouse),
      pdfMoney(r.ethical),
      r.calls.toLocaleString('en-PH'),
      r.combiPct === null ? '—' : `${(r.combiPct * 100).toFixed(1)}%`,
      r.pace,
    ]),
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, textColor: 30, lineColor: 210, lineWidth: 0.5 },
    headStyles: { fillColor: [233, 234, 236], textColor: 30, fontStyle: 'bold' },
    columnStyles: { 0: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' } },
    theme: 'grid',
  })
  return doc.output('arraybuffer')
}
