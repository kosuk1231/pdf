import { PDFDocument, degrees, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { loadPdfJs, pdfjsLib } from './pdfjs.js'
import { loadKoreanFontBytes } from './font.js'

let idSeq = 0
export const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${idSeq++}`

// --- Source files -----------------------------------------------------------

export async function loadSource(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const jsDoc = await loadPdfJs(bytes)
  return {
    id: uid('src'),
    name: file.name,
    bytes,
    jsDoc,
    pageCount: jsDoc.numPages,
  }
}

// Build the initial ordered page list for a freshly loaded source.
export function pagesFromSource(source) {
  const pages = []
  for (let i = 0; i < source.pageCount; i++) {
    pages.push({ id: uid('pg'), sourceId: source.id, srcIndex: i, rotation: 0, edits: [] })
  }
  return pages
}

// --- Text extraction (native, rotation-0 point space) -----------------------

// Returns text items with bounding boxes in PDF points, origin bottom-left.
export async function extractTextItems(source, srcIndex) {
  const page = await source.jsDoc.getPage(srcIndex + 1)
  const viewport = page.getViewport({ scale: 1, rotation: 0 })
  const H = viewport.height
  const content = await page.getTextContent()
  const items = []
  for (const it of content.items) {
    if (!it.str || !it.str.trim()) continue
    const t = pdfjsLib.Util.transform(viewport.transform, it.transform)
    const fontHeight = Math.hypot(t[2], t[3]) || Math.abs(t[3]) || 10
    const left = t[4]
    const baselineTop = t[5] // device y (top-down) of the baseline
    const width = it.width || fontHeight * it.str.length * 0.5
    items.push({
      id: uid('t'),
      str: it.str,
      // native points, origin bottom-left
      x: left,
      baseline: H - baselineTop,
      width,
      fontSize: fontHeight,
      // convenience top-origin box for overlay positioning
      topY: baselineTop - fontHeight,
      height: fontHeight,
    })
  }
  return { items, widthPt: viewport.width, heightPt: H }
}

export async function pageSizePt(source, srcIndex) {
  const page = await source.jsDoc.getPage(srcIndex + 1)
  const vp = page.getViewport({ scale: 1, rotation: 0 })
  return { widthPt: vp.width, heightPt: vp.height }
}

// --- Export ------------------------------------------------------------------

// pages: [{ sourceId, srcIndex, rotation, edits: [edit] }]
// edit:  { x, baseline, width, height, text, fontSize, color:[r,g,b], whiteout:bool }
export async function exportPdf(sources, pages) {
  const out = await PDFDocument.create()
  out.registerFontkit(fontkit)

  // Only pull in the (large) Korean font if some edit actually needs non-Latin
  // glyphs. Subsetting is disabled because the bundled fontkit drops Korean
  // glyphs during subset; full embedding renders reliably.
  const needsKorean = pages.some((p) =>
    (p.edits || []).some((e) => e.text && /[^\x00-\x7F]/.test(e.text))
  )
  const helv = await out.embedFont('Helvetica')
  let font = null
  if (needsKorean) {
    const fontBytes = await loadKoreanFontBytes()
    if (fontBytes) font = await out.embedFont(fontBytes, { subset: false })
  }
  const pickFont = (text) => (font && /[^\x00-\x7F]/.test(text) ? font : helv)

  // Cache loaded pdf-lib source docs by sourceId.
  const libDocs = new Map()
  const bySource = new Map(sources.map((s) => [s.id, s]))
  async function getLibDoc(sourceId) {
    if (libDocs.has(sourceId)) return libDocs.get(sourceId)
    const src = bySource.get(sourceId)
    const doc = await PDFDocument.load(src.bytes.slice(0))
    libDocs.set(sourceId, doc)
    return doc
  }

  for (const p of pages) {
    const srcDoc = await getLibDoc(p.sourceId)
    const [copied] = await out.copyPages(srcDoc, [p.srcIndex])
    const page = out.addPage(copied)

    for (const e of p.edits || []) {
      const size = e.fontSize || 12
      if (e.whiteout) {
        const bg = e.bg || [1, 1, 1]
        page.drawRectangle({
          x: e.x - 1.5,
          y: e.baseline - size * 0.34,
          width: (e.width || size * (e.text?.length || 1) * 0.6) + 3,
          height: size * 1.44,
          color: rgb(bg[0], bg[1], bg[2]),
        })
      }
      if (e.text) {
        const useFont = pickFont(e.text)
        const col = e.color || [0, 0, 0]
        page.drawText(e.text, {
          x: e.x,
          y: e.baseline,
          size,
          font: useFont,
          color: rgb(col[0], col[1], col[2]),
        })
      }
    }

    if (p.rotation) {
      const base = copied.getRotation().angle || 0
      page.setRotation(degrees((base + p.rotation) % 360))
    }
  }

  return out.save()
}

export function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
