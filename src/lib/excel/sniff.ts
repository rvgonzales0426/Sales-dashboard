import type { Issue } from './types'

/**
 * Rejects files that cannot be a usable workbook, before any parsing, with a
 * message that says what to do instead.
 *
 * An .xlsx is a zip (starts "PK\x03\x04"). A password-protected .xlsx is NOT a
 * zip: Excel wraps it in an OLE compound file (starts D0 CF 11 E0) holding an
 * "EncryptedPackage" stream. A legacy .xls is the same compound format without
 * that stream. The bytes tell the three apart regardless of the file name.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const ZIP = [0x50, 0x4b, 0x03, 0x04]
const CFB = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]

const startsWith = (bytes: Uint8Array, magic: number[]) => magic.every((byte, i) => bytes[i] === byte)

/** "EncryptedPackage" as UTF-16LE, the way a compound file stores stream names. */
const ENCRYPTED_MARKER = Array.from('EncryptedPackage').flatMap((ch) => [ch.charCodeAt(0), 0])

function containsSequence(bytes: Uint8Array, needle: number[]): boolean {
  outer: for (let i = 0; i <= bytes.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) continue outer
    }
    return true
  }
  return false
}

const fail = (code: Issue['code'], message: string): Issue => ({ severity: 'error', code, message })

/** Checks that need only the name and size — run before reading the file. */
export function checkFileMeta(name: string, size: number): Issue | null {
  const lower = name.toLowerCase()
  if (size === 0) {
    return fail('file_empty', 'This file is empty (0 bytes). Export the workbook from Excel again and upload that.')
  }
  if (size > MAX_UPLOAD_BYTES) {
    const mb = (size / 1024 / 1024).toFixed(1)
    return fail('file_too_large', `This file is ${mb} MB; the limit is 10 MB. Remove pictures or extra sheets and save again.`)
  }
  if (lower.endsWith('.xls')) {
    return fail('file_legacy_xls', 'This is an old .xls file. Open it in Excel, choose File → Save As → Excel Workbook (.xlsx), and upload that.')
  }
  if (lower.endsWith('.xlsm') || lower.endsWith('.xlsb')) {
    return fail('file_wrong_type', 'Macro-enabled and binary workbooks are not accepted. Save it as an Excel Workbook (.xlsx).')
  }
  if (lower.endsWith('.csv')) {
    return fail('file_wrong_type', 'CSV files lose the merged header rows the import relies on. Upload the .xlsx workbook instead.')
  }
  if (!lower.endsWith('.xlsx')) {
    return fail('file_wrong_type', 'Only Excel workbooks (.xlsx) can be uploaded.')
  }
  return null
}

/** Checks on the bytes themselves. */
export function checkFileBytes(bytes: Uint8Array): Issue | null {
  if (bytes.length === 0) {
    return fail('file_empty', 'This file is empty (0 bytes). Export the workbook from Excel again and upload that.')
  }
  if (startsWith(bytes, ZIP)) return null
  if (startsWith(bytes, CFB)) {
    return containsSequence(bytes, ENCRYPTED_MARKER)
      ? fail(
          'file_encrypted',
          'This workbook is password-protected. In Excel, open it, go to File → Info → Protect Workbook → Encrypt with Password, clear the password, save, and upload again.',
        )
      : fail('file_legacy_xls', 'This is an old .xls file renamed to .xlsx. Open it in Excel, choose File → Save As → Excel Workbook (.xlsx), and upload that.')
  }
  return fail('file_unreadable', 'This is not an Excel workbook. Upload the .xlsx file exported from Excel.')
}

/** SHA-256 of the original bytes, stored with the upload for audit. */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
