import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { checkFileBytes, checkFileMeta, MAX_UPLOAD_BYTES } from '@/lib/excel/sniff'
import { FIXTURE, parseBytes, readBytes } from '../helpers/workbooks'

/* Bad files fail gracefully, each with a message that says what to fix. */

const bytes = (...values: number[]) => new Uint8Array(values).buffer as ArrayBuffer

/** A compound-file header, optionally with an EncryptedPackage stream name. */
function compoundFile(encrypted: boolean): ArrayBuffer {
  const header = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
  const body = new Array(512).fill(0)
  const name = encrypted ? 'EncryptedPackage' : 'Workbook'
  const utf16 = Array.from(name).flatMap((ch) => [ch.charCodeAt(0), 0])
  return new Uint8Array([...header, ...body, ...utf16, ...body]).buffer as ArrayBuffer
}

describe('file checks', () => {
  it('rejects an empty file', async () => {
    const result = await parseBytes(bytes(), 'empty.xlsx')
    expect(result.fatal?.code).toBe('file_empty')
  })

  it('rejects files over 10 MB by size alone', () => {
    expect(checkFileMeta('big.xlsx', MAX_UPLOAD_BYTES + 1)?.code).toBe('file_too_large')
    expect(checkFileMeta('ok.xlsx', MAX_UPLOAD_BYTES)).toBeNull()
  })

  it('explains a password-protected workbook', async () => {
    const result = await parseBytes(compoundFile(true), 'locked.xlsx')
    expect(result.fatal?.code).toBe('file_encrypted')
    expect(result.fatal?.message).toMatch(/password/i)
  })

  it('says "password" even when the protected file was renamed', async () => {
    const result = await parseBytes(compoundFile(true), 'locked.xls')
    expect(result.fatal?.code).toBe('file_encrypted')
  })

  it('spots a legacy .xls by name and by bytes', async () => {
    expect(checkFileMeta('old.xls', 1000)?.code).toBe('file_legacy_xls')
    expect(checkFileBytes(new Uint8Array(compoundFile(false)))?.code).toBe('file_legacy_xls')
  })

  it('turns away CSV and macro workbooks with a reason', () => {
    expect(checkFileMeta('export.csv', 100)?.message).toMatch(/merged header/)
    expect(checkFileMeta('macros.xlsm', 100)?.code).toBe('file_wrong_type')
    expect(checkFileMeta('photo.png', 100)?.code).toBe('file_wrong_type')
  })

  it('rejects bytes that are not a workbook', async () => {
    const result = await parseBytes(new TextEncoder().encode('hello, not a spreadsheet').buffer as ArrayBuffer)
    expect(result.fatal?.code).toBe('file_unreadable')
  })

  it('rejects a damaged zip', async () => {
    const real = new Uint8Array(readBytes(FIXTURE))
    const cut = real.slice(0, Math.floor(real.length / 3)).buffer as ArrayBuffer
    const result = await parseBytes(cut)
    expect(result.fatal?.code).toBe('file_unreadable')
  })

  it('reports a workbook whose sheets are all empty', async () => {
    const wb = new ExcelJS.Workbook()
    wb.addWorksheet('Sheet1')
    const result = await parseBytes((await wb.xlsx.writeBuffer()) as ArrayBuffer)
    expect(result.fatal?.code).toBe('file_empty')
  })

  it('lists the sheets when none has the performance table', async () => {
    const wb = new ExcelJS.Workbook()
    wb.addWorksheet('Summary').getCell('A1').value = 'Quarterly summary'
    wb.addWorksheet('Chart').getCell('B2').value = 42
    const result = await parseBytes((await wb.xlsx.writeBuffer()) as ArrayBuffer)
    expect(result.fatal?.code).toBe('sheet_not_found')
    expect(result.fatal?.message).toContain('Summary, Chart')
  })
})
