import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export { pdfjsLib }

// Load a pdf.js document from raw bytes. We clone the buffer because pdf.js
// transfers ownership of the ArrayBuffer to its worker, which would detach
// the bytes we still need for pdf-lib export.
export async function loadPdfJs(bytes) {
  const copy = bytes.slice(0)
  const task = pdfjsLib.getDocument({ data: copy })
  return task.promise
}
