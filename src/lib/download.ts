/** Hands the browser a file to save. */
export function saveFile(data: BlobPart, fileName: string, type: string) {
  const blob = data instanceof Blob ? data : new Blob([data], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Give the download a moment to start before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Opens a (signed) URL as a download. */
export function downloadFromUrl(url: string) {
  const link = document.createElement('a')
  link.href = url
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}
