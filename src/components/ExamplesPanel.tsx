import { useState, useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { EXAMPLE_SKETCHES } from '../utils/templates'
import { useStore } from '../store/store'
import SketchPreview from './SketchPreview'
import { Badge } from './ui/badge'

const THUMB_H = 80

function SketchThumbnail({ sketch }: { sketch: typeof EXAMPLE_SKETCHES[0] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)

  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver((entries) => {
      setW(Math.floor(entries[0].contentRect.width))
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={ref} style={{ width: '100%', height: THUMB_H, background: '#0a0a0a', overflow: 'hidden', pointerEvents: 'none' }}>
      {w > 0 && (
        <SketchPreview
          code={sketch.code}
          library={sketch.library}
          isRunning={true}
          generationKey={0}
          width={w}
          height={THUMB_H}
        />
      )}
    </div>
  )
}

export const EXAMPLE_DRAG_MIME = 'application/x-melanie-example'

export default function ExamplesPanel() {
  const store    = useStore()
  const { screenToFlowPosition } = useReactFlow()
  const [search, setSearch] = useState('')

  const filtered = EXAMPLE_SKETCHES.filter(
    (e) =>
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase())
  )

  function addToCanvas(sketch: typeof EXAMPLE_SKETCHES[0]) {
    const pane = document.querySelector('.react-flow') as HTMLElement | null
    let flowX = 200, flowY = 200
    if (pane) {
      const r = pane.getBoundingClientRect()
      const p = screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
      flowX = p.x - 140
      flowY = p.y - 130
    }
    store.addSketchNode({
      code:           sketch.code,
      library:        sketch.library,
      position:       { x: flowX, y: flowY },
      title:          sketch.title,
      semanticLabels: sketch.semanticLabels,
    })
  }

  function handleDragStart(e: React.DragEvent, sketch: typeof EXAMPLE_SKETCHES[0]) {
    e.dataTransfer.setData(EXAMPLE_DRAG_MIME, sketch.id)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0c0c0c', borderRight: '1px solid #222' }}>
      {/* Header */}
      <div style={{ padding: '10px 10px 8px', flexShrink: 0, borderBottom: '1px solid #1e1e1e' }}>
        <p style={{
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.1em', color: '#505050', marginBottom: 8,
        }}>
          Examples
        </p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          style={{
            width: '100%', height: 26,
            background: '#111', border: '1px solid #2a2a2a', borderRadius: 2,
            color: '#d0d0d0', fontSize: 12, padding: '0 8px',
            fontFamily: 'var(--font-sans)', outline: 'none',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#8C49DF' }}
          onBlur={(e)  => { e.currentTarget.style.borderColor = '#2a2a2a' }}
        />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px', minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8 }}>
          {filtered.map((sketch) => (
            <button
              key={sketch.id}
              onClick={() => addToCanvas(sketch)}
              draggable
              onDragStart={(e) => handleDragStart(e, sketch)}
              title={`Click or drag "${sketch.title}" onto the canvas`}
              style={{
                width: '100%', textAlign: 'left',
                background: '#111', border: '1px solid #222', borderRadius: 3,
                overflow: 'hidden', cursor: 'grab',
                transition: 'border-color 0.1s',
                display: 'block',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#8C49DF' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#222' }}
            >
              {/* Thumbnail */}
              <SketchThumbnail sketch={sketch} />
              {/* Meta */}
              <div style={{ padding: '5px 8px 6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#c0c0c0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sketch.title}
                  </span>
                  <Badge variant={sketch.library === 'p5js' ? 'p5' : 'threejs'} className="rounded-sm text-[10px] flex-shrink-0">
                    {sketch.library === 'p5js' ? 'p5' : '3js'}
                  </Badge>
                </div>
                <p style={{ fontSize: 10, color: '#505050', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {sketch.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* New sketch buttons */}
      <div style={{ borderTop: '1px solid #1e1e1e', padding: '8px 8px 10px', flexShrink: 0 }}>
        <p style={{ fontSize: 10, color: '#444', marginBottom: 6, fontWeight: 500 }}>New blank sketch</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button
            onClick={() => store.addSketchNode({ library: 'p5js', position: { x: 200, y: 200 } })}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '5px 8px',
              border: '1px solid rgba(16,185,129,0.25)', borderRadius: 3,
              background: 'transparent', color: '#10b981',
              fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.08)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 20, height: 20, border: '2px solid rgba(16,185,129,0.4)',
              borderRadius: 2, fontSize: 13, fontWeight: 700, flexShrink: 0,
            }}>+</span>
            p5.js sketch
          </button>
          <button
            onClick={() => store.addSketchNode({ library: 'threejs', position: { x: 200, y: 300 } })}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '5px 8px',
              border: '1px solid rgba(59,130,246,0.25)', borderRadius: 3,
              background: 'transparent', color: '#3b82f6',
              fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.08)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 20, height: 20, border: '2px solid rgba(59,130,246,0.4)',
              borderRadius: 2, fontSize: 13, fontWeight: 700, flexShrink: 0,
            }}>+</span>
            three.js sketch
          </button>
        </div>
      </div>
    </div>
  )
}
