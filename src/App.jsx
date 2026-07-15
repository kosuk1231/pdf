import { useMemo, useRef, useState } from 'react'
import {
  loadSource,
  pagesFromSource,
  exportPdf,
  downloadBytes,
} from './lib/editor.js'
import Thumb from './components/Thumb.jsx'
import PageCanvas from './components/PageCanvas.jsx'
import {
  IconOpen, IconRotL, IconRotR, IconTrash, IconText, IconSplit,
  IconDownload, IconUp, IconDown, IconShield, IconLoad, IconPlus,
} from './components/icons.jsx'

export default function App() {
  const [sources, setSources] = useState([])
  const [pages, setPages] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [mode, setMode] = useState('select')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const [over, setOver] = useState(false)
  const [dragId, setDragId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const fileRef = useRef(null)

  const sourceMap = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources])
  const active = pages.find((p) => p.id === activeId) || null
  const activeSource = active ? sourceMap.get(active.sourceId) : null

  const flash = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  async function openFiles(list) {
    const files = Array.from(list).filter((f) => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    if (!files.length) return flash('PDF 파일만 열 수 있어요')
    setBusy(true)
    try {
      const loaded = []
      const newPages = []
      for (const f of files) {
        const src = await loadSource(f)
        loaded.push(src)
        newPages.push(...pagesFromSource(src))
      }
      setSources((s) => [...s, ...loaded])
      setPages((p) => {
        const merged = [...p, ...newPages]
        if (!activeId && merged.length) setActiveId(merged[0].id)
        return merged
      })
      flash(`${files.length}개 파일, ${newPages.length}페이지 추가`)
    } catch (e) {
      console.error(e)
      flash('파일을 여는 중 문제가 발생했어요')
    } finally {
      setBusy(false)
    }
  }

  const rotateActive = (delta) => {
    if (!active) return
    setPages((ps) =>
      ps.map((p) => (p.id === activeId ? { ...p, rotation: ((p.rotation + delta) % 360 + 360) % 360 } : p))
    )
  }

  const deletePage = (id) => {
    setPages((ps) => {
      const idx = ps.findIndex((p) => p.id === id)
      const next = ps.filter((p) => p.id !== id)
      if (id === activeId) setActiveId(next[Math.min(idx, next.length - 1)]?.id || null)
      return next
    })
    setSelected((s) => {
      const n = new Set(s)
      n.delete(id)
      return n
    })
  }

  const move = (id, dir) => {
    setPages((ps) => {
      const i = ps.findIndex((p) => p.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= ps.length) return ps
      const next = [...ps]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  const reorderDrop = (targetId) => {
    if (!dragId || dragId === targetId) return
    setPages((ps) => {
      const from = ps.findIndex((p) => p.id === dragId)
      const to = ps.findIndex((p) => p.id === targetId)
      if (from < 0 || to < 0) return ps
      const next = [...ps]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    setDragId(null)
    setDragOverId(null)
  }

  const toggleSelect = (id) => {
    setSelected((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const setActiveEdits = (edits) =>
    setPages((ps) => ps.map((p) => (p.id === activeId ? { ...p, edits } : p)))

  async function runExport(subset, filename) {
    if (!subset.length) return
    setBusy(true)
    try {
      const bytes = await exportPdf(sources, subset)
      downloadBytes(bytes, filename)
      flash('저장 완료')
    } catch (e) {
      console.error(e)
      flash('내보내기 중 문제가 발생했어요')
    } finally {
      setBusy(false)
    }
  }

  const exportAll = () => runExport(pages, 'edited.pdf')
  const exportSelected = () => {
    const subset = pages.filter((p) => selected.has(p.id))
    runExport(subset, `split-${subset.length}p.pdf`)
  }

  const editCount = pages.reduce((n, p) => n + (p.edits?.length || 0), 0)
  const hasDoc = pages.length > 0

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="mark">PDF</span>
          <span>작업대</span>
          <span className="tag">회전 · 분할 · 병합 · 편집</span>
        </div>
        <div className="spacer" />
        {hasDoc && (
          <span className="count">
            {pages.length}p{editCount > 0 ? ` · 편집 ${editCount}` : ''}
          </span>
        )}
        <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
          {hasDoc ? <IconPlus /> : <IconOpen />}
          {hasDoc ? '파일 추가' : '파일 열기'}
        </button>
        <button className="btn primary" onClick={exportAll} disabled={busy || !hasDoc}>
          {busy ? <IconLoad className="icon spin" /> : <IconDownload />}
          내보내기
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden-input"
          onChange={(e) => {
            openFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </header>

      {!hasDoc ? (
        <div
          className="empty"
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            openFiles(e.dataTransfer.files)
          }}
        >
          <div className={'drop' + (over ? ' over' : '')}>
            <h1>PDF를 여기에 놓으세요</h1>
            <p>
              회전 · 분할 · 병합, 그리고 텍스트 편집까지 브라우저에서 바로 처리합니다.
              여러 개를 한 번에 열면 자동으로 병합 대기 상태가 됩니다.
            </p>
            <button className="btn primary" onClick={() => fileRef.current?.click()}>
              <IconOpen /> 파일 열기
            </button>
            <span className="privacy">
              <IconShield /> 파일은 서버로 전송되지 않고 이 브라우저 안에서만 처리됩니다
            </span>
          </div>
        </div>
      ) : (
        <div className="work">
          <aside className="sidebar">
            <div className="sidebar-head">
              <span className="h">페이지</span>
              <div className="spacer" style={{ flex: 1 }} />
              {selected.size > 0 && (
                <button className="btn ghost sm" onClick={() => setSelected(new Set())}>
                  선택 해제
                </button>
              )}
            </div>
            <div className="thumbs">
              {pages.map((p, i) => {
                const src = sourceMap.get(p.sourceId)
                return (
                  <div
                    key={p.id}
                    className={
                      'thumb' +
                      (p.id === activeId ? ' active' : '') +
                      (p.id === dragOverId ? ' dragover' : '')
                    }
                    draggable
                    onDragStart={() => setDragId(p.id)}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragOverId(p.id)
                    }}
                    onDragLeave={() => setDragOverId((d) => (d === p.id ? null : d))}
                    onDrop={() => reorderDrop(p.id)}
                    onClick={() => setActiveId(p.id)}
                  >
                    <input
                      type="checkbox"
                      className="chk"
                      checked={selected.has(p.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelect(p.id)}
                      title="분할 대상 선택"
                    />
                    <span className="num">{i + 1}</span>
                    <div className="canvas-wrap">
                      <Thumb source={src} srcIndex={p.srcIndex} rotation={p.rotation} />
                    </div>
                    <div className="meta">
                      <div className="src" title={src.name}>
                        {src.name}
                      </div>
                      {p.rotation !== 0 && <span className="rot">{p.rotation}°</span>}
                      {p.edits?.length > 0 && <span className="rot"> · edit {p.edits.length}</span>}
                      <div className="row">
                        <button className="btn ghost sm" title="위로" onClick={(e) => { e.stopPropagation(); move(p.id, -1) }}>
                          <IconUp />
                        </button>
                        <button className="btn ghost sm" title="아래로" onClick={(e) => { e.stopPropagation(); move(p.id, 1) }}>
                          <IconDown />
                        </button>
                        <button className="btn ghost sm danger" title="삭제" onClick={(e) => { e.stopPropagation(); deletePage(p.id) }}>
                          <IconTrash />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="sidebar-foot">
              <span className="sel">{selected.size}개 선택됨</span>
              <button className="btn" onClick={exportSelected} disabled={busy || selected.size === 0}>
                <IconSplit /> 선택 페이지로 분할 저장
              </button>
            </div>
          </aside>

          <section className="stage">
            <div className="toolbar">
              <button className="btn sm" onClick={() => rotateActive(-90)} disabled={!active}>
                <IconRotL /> 왼쪽
              </button>
              <button className="btn sm" onClick={() => rotateActive(90)} disabled={!active}>
                <IconRotR /> 오른쪽
              </button>
              <button className="btn sm danger" onClick={() => active && deletePage(active.id)} disabled={!active}>
                <IconTrash /> 삭제
              </button>
              <div className="div" />
              <div className="mode">
                <button className={mode === 'select' ? 'on' : ''} onClick={() => setMode('select')}>
                  이동
                </button>
                <button className={mode === 'text' ? 'on' : ''} onClick={() => setMode('text')}>
                  텍스트 편집
                </button>
              </div>
              <span className="hint">
                {mode === 'text'
                  ? active && active.rotation !== 0
                    ? '회전된 페이지는 편집 전 회전을 0°로 되돌려 주세요'
                    : '글자를 클릭해 수정하거나, 빈 곳을 클릭해 새 텍스트를 추가하세요'
                  : '왼쪽에서 페이지를 끌어 순서를 바꾸거나 선택해 분할할 수 있어요'}
              </span>
            </div>
            {active && activeSource ? (
              <PageCanvas
                key={active.id}
                page={active}
                source={activeSource}
                mode={mode}
                onEdits={setActiveEdits}
              />
            ) : (
              <div className="empty">
                <div style={{ color: 'var(--slate)' }}>페이지를 선택하세요</div>
              </div>
            )}
          </section>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
