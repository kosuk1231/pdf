// Loads the bundled Korean-capable font once and caches the bytes so the
// export step can embed it into the output PDF. Falls back gracefully if the
// asset is missing (Latin-only text will still render via the standard font).
let cache = null

export async function loadKoreanFontBytes() {
  if (cache) return cache
  try {
    const res = await fetch('/fonts/KoreanText-Regular.ttf')
    if (!res.ok) throw new Error(`font ${res.status}`)
    const buf = await res.arrayBuffer()
    cache = new Uint8Array(buf)
    return cache
  } catch (err) {
    console.warn('Korean font unavailable, falling back to Latin font:', err)
    return null
  }
}
