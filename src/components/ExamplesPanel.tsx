import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useReactFlow } from '@xyflow/react'
import { EXAMPLE_SKETCHES } from '../utils/templates'
import { useStore } from '../store/store'
import SketchPreview from './SketchPreview'
import Icon from './ui/Icon'
import { Badge } from './ui/badge'
import type { LibraryType, SourceType } from '../utils/types'

const THUMB_H = 80

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  root:         { display: 'flex', flexDirection: 'column', height: '100%', background: '#0c0c0c', borderRight: '1px solid #222' } as React.CSSProperties,
  header:       { padding: '10px 10px 8px', flexShrink: 0, borderBottom: '1px solid #1e1e1e' } as React.CSSProperties,
  sectionLabel: { fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#505050', marginBottom: 8 },
  searchInput:  { width: '100%', height: 26, background: '#111', border: '1px solid #2a2a2a', borderRadius: 2, color: '#d0d0d0', fontSize: 12, padding: '0 8px', fontFamily: 'var(--font-sans)', outline: 'none' } as React.CSSProperties,
  list:         { flex: 1, overflowY: 'auto' as const, padding: '6px 8px', minHeight: 0 },
  footer:       { borderTop: '1px solid #1e1e1e', padding: '8px 8px 10px', flexShrink: 0 },
  sketchBtn:    { width: '100%', textAlign: 'left' as const, background: '#111', border: '1px solid #222', borderRadius: 3, overflow: 'hidden', cursor: 'grab', transition: 'border-color 0.1s', display: 'block' } as React.CSSProperties,
  thumb:        { width: '100%', height: THUMB_H, background: '#0a0a0a', overflow: 'hidden', pointerEvents: 'none' as const },
  sketchMeta:   { padding: '5px 8px 6px' },
  sketchTitle:  { fontSize: 11, fontWeight: 600, color: '#c0c0c0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } as React.CSSProperties,
  sketchDesc:   { fontSize: 10, color: '#505050', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties,
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SketchThumbnail({ sketch }: { sketch: typeof EXAMPLE_SKETCHES[0] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} style={S.thumb}>
      {w > 0 && <SketchPreview code={sketch.code} library={sketch.library} isRunning generationKey={0} width={w} height={THUMB_H} />}
    </div>
  )
}

function NewNodeButton({ label, color, icon, onClick }: {
  label: string; color: string; icon?: string; onClick: () => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', padding: '5px 8px',
        border: `1px solid ${color}40`, borderRadius: 3,
        background: hov ? `${color}14` : 'transparent', color,
        fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500,
        cursor: 'pointer', transition: 'all 0.1s',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, border: `2px solid ${color}66`, borderRadius: 2, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
        {icon ? <Icon name={icon} size={11} /> : '+'}
      </span>
      {label}
    </button>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export const EXAMPLE_DRAG_MIME = 'application/x-melanie-example'

export default function ExamplesPanel() {
  const store = useStore()
  const { screenToFlowPosition } = useReactFlow()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() =>
    EXAMPLE_SKETCHES.filter((e) =>
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase())
    ), [search])

  const addToCanvas = useCallback((sketch: typeof EXAMPLE_SKETCHES[0]) => {
    const pane = document.querySelector('.react-flow') as HTMLElement | null
    let flowX = 200, flowY = 200
    if (pane) {
      const r = pane.getBoundingClientRect()
      const p = screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
      flowX = p.x - 140; flowY = p.y - 130
    }
    store.addSketchNode({ code: sketch.code, library: sketch.library, position: { x: flowX, y: flowY }, title: sketch.title, semanticLabels: sketch.semanticLabels })
  }, [screenToFlowPosition, store])

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.setData(EXAMPLE_DRAG_MIME, id)
    e.dataTransfer.effectAllowed = 'copy'
  }, [])

  return (
    <div style={S.root}>
      <div style={S.header}>
        <p style={S.sectionLabel}>Examples</p>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…" style={S.searchInput}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#8C49DF' }}
          onBlur={(e)  => { e.currentTarget.style.borderColor = '#2a2a2a' }}
        />
      </div>

      <div style={S.list}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8 }}>
          {filtered.map((sketch) => (
            <button key={sketch.id} onClick={() => addToCanvas(sketch)} draggable
              onDragStart={(e) => handleDragStart(e, sketch.id)}
              title={`Click or drag "${sketch.title}" onto the canvas`}
              style={S.sketchBtn}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#8C49DF' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#222' }}
            >
              <SketchThumbnail sketch={sketch} />
              <div style={S.sketchMeta}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 2 }}>
                  <span style={S.sketchTitle}>{sketch.title}</span>
                  <Badge variant={sketch.library === 'p5js' ? 'p5' : 'threejs'} className="rounded-sm text-[10px] flex-shrink-0">
                    {sketch.library === 'p5js' ? 'p5' : '3js'}
                  </Badge>
                </div>
                <p style={S.sketchDesc}>{sketch.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={S.footer}>
        <p style={{ fontSize: 10, color: '#444', marginBottom: 6, fontWeight: 500 }}>New blank sketch</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
          <NewNodeButton label="p5.js sketch"    color="#10b981" onClick={() => store.addSketchNode({ library: 'p5js',    position: { x: 200, y: 200 } })} />
          <NewNodeButton label="three.js sketch" color="#3b82f6" onClick={() => store.addSketchNode({ library: 'threejs', position: { x: 200, y: 300 } })} />
        </div>
        <p style={{ fontSize: 10, color: '#444', marginBottom: 6, fontWeight: 500 }}>Signal sources</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {([
            { sourceType: 'lfo'   as SourceType, label: 'LFO',         color: '#0ea5e9', icon: 'lfo'   },
            { sourceType: 'audio' as SourceType, label: 'Audio Level', color: '#10b981', icon: 'audio' },
            { sourceType: 'clock' as SourceType, label: 'Clock',       color: '#f59e0b', icon: 'clock' },
          ]).map(({ sourceType, label, color, icon }) => (
            <NewNodeButton key={sourceType} label={label} color={color} icon={icon}
              onClick={() => store.addSourceNode({ sourceType, position: { x: 200, y: 200 } })} />
          ))}
        </div>
      </div>
    </div>
  )
}
