/**
 * Writes tests/fixtures/sample-q4.xlsx from the real workbook, with every
 * person's name swapped for a placeholder. Layout, merges, formulas, cached
 * results and numbers are untouched, so tests against the copy prove the same
 * things as tests against the original.
 *
 *   npx tsx scripts/anonymize-fixture.ts [path/to/real.xlsx]
 *
 * The real file lives in tests/fixtures/private/ (gitignored) and must never
 * be committed. Run this again whenever the real sample changes.
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import ExcelJS from 'exceljs'

const SOURCE = resolve(process.argv[2] ?? 'tests/fixtures/private/SALES_DASHBOARD.xlsx')
const TARGET = resolve('tests/fixtures/sample-q4.xlsx')

/**
 * Placeholders, assigned in sheet order. They deliberately include an accent
 * (Ibañez), a space (Dela Peña) and a hyphen-free double first name so the
 * fixture exercises name normalization too.
 */
const PLACEHOLDERS: [string, string][] = [
  ['Alcantara', 'Rhea Mae'],
  ['Bautista', 'Joy'],
  ['Cruz', 'Daniel'],
  ['Dela Peña', 'Marco Jose'],
  ['Espino', 'Ramil'],
  ['Flores', 'Jessa Ann'],
  ['Ibañez', 'Arlene'],
  ['Lim', 'Kevin'],
  ['Mendoza', 'Ronald'],
  ['Navarro', 'Jessie'],
  ['Ocampo', 'Mary Grace'],
  ['Pascual', 'Ireneo'],
]

async function main() {
  if (!existsSync(SOURCE)) {
    console.error(`Real workbook not found at ${SOURCE}. Copy it into tests/fixtures/private/ first.`)
    process.exit(1)
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(SOURCE)

  // Workbook properties often carry the author's real name.
  workbook.creator = 'Sales Cockpit'
  workbook.lastModifiedBy = 'Sales Cockpit'
  workbook.company = ''
  workbook.manager = ''
  workbook.title = 'Sample performance workbook (anonymized)'

  const source = workbook.getWorksheet('Sheet1')
  if (!source) throw new Error('Expected a Sheet1 in the real workbook.')

  // Map each real name to a placeholder, in row order, stopping at TOTAL.
  const realToFake = new Map<string, [string, string]>()
  let next = 0
  for (let r = 6; r <= source.rowCount; r++) {
    const last = String(source.getCell(r, 1).value ?? '').trim()
    const first = String(source.getCell(r, 2).value ?? '').trim()
    if (!last && !first) continue
    if (/^total$/i.test(last)) break
    const fake = PLACEHOLDERS[next++]
    if (!fake) throw new Error('More people than placeholders; extend PLACEHOLDERS.')
    realToFake.set(last.toLowerCase(), fake)
    source.getCell(r, 1).value = fake[0]
    source.getCell(r, 2).value = fake[1]
  }

  // The DASHBOARD sheet's agent picker holds a last name too.
  const dashboard = workbook.getWorksheet('DASHBOARD')
  if (dashboard) {
    const picked = String(dashboard.getCell('A6').value ?? '').trim().toLowerCase()
    const fake = realToFake.get(picked)
    if (fake) dashboard.getCell('A6').value = fake[0]
  }

  await workbook.xlsx.writeFile(TARGET)
  console.log(`Wrote ${TARGET} with ${realToFake.size} placeholder names.`)
}

main()
