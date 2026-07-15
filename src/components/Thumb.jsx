import { useEffect, useRef } from 'react'

// Renders one page to a small canvas. Re-renders when rotation changes.
export default function Thumb({ source, srcIndex, rotation }) {
  const ref = useRef(null)
  const taskRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    async function render() {
      const page = await source.jsDoc.getPage(srcIndex + 1)
      if (cancelled) return
      const base = page.getViewport({ scale: 1, rotation })
      const scale = Math.min(56 / base.width, 76 / base.height)
      const viewport = page.getViewport({ scale, rotation })
      const canvas = ref.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.ceil(viewport.width * dpr)
      canvas.height = Math.ceil(viewport.height * dpr)
      canvas.style.width = `${Math.ceil(viewport.width)}px`
      canvas.style.height = `${Math.ceil(viewport.height)}px`
      ctx.scale(dpr, dpr)
      try {
        taskRef.current = page.render({ canvasContext: ctx, viewport })
        await taskRef.current.promise
      } catch (e) {
        /* render cancelled */
      }
    }
    render()
    return () => {
      cancelled = true
      if (taskRef.current) taskRef.current.cancel?.()
    }
  }, [source, srcIndex, rotation])

  return <canvas ref={ref} />
}
