import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { extractTextItems } from '../lib/editor.js'

const MAX_SCALE = 2.2
const keyOf = (it) => `${Math.round(it.x)}:${Math.round(it.baseline)}:${it.str.length}`

// A single editable text box overlaid on the rendered page.
function EditBox({ box, editing, onStart, onCommit, onCancel }) {
  const ref = useRef(null)

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.textContent = box.text
      const r = document.createRange()
      r.selectNodeContents(ref.current)
      r.collapse(false)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(r)
      ref.current.focus()
    }
  }, [editing]) // eslint-disable-line react-hooks/exhaustive-deps

  const commit = () => onCommit(ref.current ? ref.current.textContent : box.text)
  const showInk = editing || box.edited || box.custom

  return (
    <div
      ref={ref}
      className={
        'edit-box' + (editing ? ' editing' : '') + (box.custom && !editing ? ' custom' : '')
      }
      style={{
        left: box.left,
        top: box.top,
        minWidth: box.width,
        height: editing ? 'auto' : box.height,
        fontSize: box.fontSize,
        lineHeight: `${box.height}px`,
        color: showInk ? 'var(--ink)' : 'transparent',
        background: showInk && !editing ? '#fff' : undefined,
      }}
      contentEditable={editing}
      suppressContentEditableWarning
      onMouseDown={(e) => {
        if (!editing) {
          e.preventDefault()
          onStart()
        }
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          onCancel()
        }
      }}
    >
      {!editing ? box.text : null}
    </div>
  )
}

export default function PageCanvas({ page, source, mode, onEdits }) {
  const scrollRef = useRef(null)
  const canvasRef = useRef(null)
  const renderTask = useRef(null)
  const [extract, setExtract] = useState(null) // { items, widthPt, heightPt }
  const [scale, setScale] = useState(1)
  const [editingId, setEditingId] = useState(null)

  const editable = page.rotation === 0
  const edits = page.edits || []

  // Extract text once per (page,source), at native rotation-0 geometry.
  useEffect(() => {
    let alive = true
    setEditingId(null)
    extractTextItems(source, page.srcIndex).then((r) => {
      if (alive) setExtract(r)
    })
    return () => {
      alive = false
    }
  }, [source, page.srcIndex])

  // Fit-to-width scale.
  useLayoutEffect(() => {
    if (!extract) return
    const el = scrollRef.current
    const avail = (el ? el.clientWidth : 900) - 56
    const rotated = page.rotation === 90 || page.rotation === 270
    const w = rotated ? extract.heightPt : extract.widthPt
    setScale(Math.min(MAX_SCALE, Math.max(0.2, avail / w)))
  }, [extract, page.rotation])

  // Render the page bitmap.
  useEffect(() => {
    let alive = true
    async function render() {
      if (!extract) return
      const pg = await source.jsDoc.getPage(page.srcIndex + 1)
      if (!alive) return
      const viewport = pg.getViewport({ scale, rotation: page.rotation })
      const canvas = canvasRef.current
      if (!canvas) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.ceil(viewport.width * dpr)
      canvas.height = Math.ceil(viewport.height * dpr)
      canvas.style.width = `${Math.ceil(viewport.width)}px`
      canvas.style.height = `${Math.ceil(viewport.height)}px`
      const ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      try {
        renderTask.current?.cancel?.()
        renderTask.current = pg.render({ canvasContext: ctx, viewport })
        await renderTask.current.promise
      } catch (e) {
        /* cancelled */
      }
    }
    render()
    return () => {
      alive = false
      renderTask.current?.cancel?.()
    }
  }, [extract, scale, page.rotation, page.srcIndex, source])

  const editByKey = (k) => edits.find((e) => e.key === k)

  const upsert = useCallback(
    (next) => onEdits(next),
    [onEdits]
  )

  const commitExisting = (item, text) => {
    const k = keyOf(item)
    const rest = edits.filter((e) => e.key !== k)
    if (text.trim() === item.str.trim()) {
      upsert(rest) // reverted → drop edit
    } else {
      upsert([
        ...rest,
        {
          key: k,
          x: item.x,
          baseline: item.baseline,
          width: item.width,
          fontSize: item.fontSize,
          text,
          whiteout: true,
          color: [0, 0, 0],
        },
      ])
    }
    setEditingId(null)
  }

  const commitCustom = (id, text) => {
    const rest = edits.filter((e) => e.id !== id)
    if (!text.trim()) upsert(rest)
    else upsert([...rest, { ...edits.find((e) => e.id === id), text }])
    setEditingId(null)
  }

  // Add-text: click empty area in text mode.
  const onStageClick = (e) => {
    if (mode !== 'text' || !editable || !extract) return
    if (e.target.classList.contains('edit-box')) return
    const frame = e.currentTarget.getBoundingClientRect()
    const sx = e.clientX - frame.left
    const sy = e.clientY - frame.top
    const fontSize = 14
    const nx = sx / scale
    const topNative = sy / scale
    const baseline = extract.heightPt - topNative - fontSize
    const id = `c_${Date.now()}`
    upsert([
      ...edits,
      { id, custom: true, x: nx, baseline, width: 40, fontSize, text: '', whiteout: false, color: [0, 0, 0] },
    ])
    setEditingId(id)
  }

  if (!extract) {
    return (
      <div className="empty">
        <div style={{ color: 'var(--slate)', fontSize: 13 }}>페이지 여는 중…</div>
      </div>
    )
  }

  // Build overlay boxes.
  const boxes = []
  if (editable) {
    for (const item of extract.items) {
      const k = keyOf(item)
      const edit = editByKey(k)
      boxes.push({
        kind: 'existing',
        idKey: k,
        item,
        left: item.x * scale,
        top: item.topY * scale,
        width: Math.max(item.width, 6) * scale,
        height: Math.max(item.height, 8) * scale,
        fontSize: item.fontSize * scale,
        text: edit ? edit.text : item.str,
        edited: !!edit,
      })
    }
    for (const e of edits.filter((x) => x.custom)) {
      boxes.push({
        kind: 'custom',
        idKey: e.id,
        left: e.x * scale,
        top: (extract.heightPt - e.baseline - e.fontSize) * scale,
        width: Math.max(e.width, 40) * scale,
        height: e.fontSize * 1.3 * scale,
        fontSize: e.fontSize * scale,
        text: e.text,
        custom: true,
      })
    }
  }

  return (
    <div className="canvas-scroll" ref={scrollRef}>
      <div
        className="page-frame"
        onMouseDown={onStageClick}
        style={{ cursor: mode === 'text' && editable ? 'text' : 'default' }}
      >
        <canvas ref={canvasRef} />
        {editable && (
          <div className={'edit-layer' + (mode === 'text' ? '' : ' readonly')}>
            {boxes.map((b) => (
              <EditBox
                key={b.idKey}
                box={b}
                editing={editingId === b.idKey}
                onStart={() => setEditingId(b.idKey)}
                onCommit={(text) =>
                  b.kind === 'existing' ? commitExisting(b.item, text) : commitCustom(b.idKey, text)
                }
                onCancel={() => setEditingId(null)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
