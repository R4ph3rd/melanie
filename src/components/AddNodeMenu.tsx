import { useState, useCallback, useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useStore } from '../store/store'
import Icon from './ui/Icon'
import {
  CATEGORY_ORDER, CATEGORY_LABELS, CATEGORY_COLORS,
  OPERATORS, SOURCES, SKETCHES, type NodeCategory,
} from '../utils/nodeCatalog'

const MENU_W = 230

interface Props {
  anchor: { x: number; y: number } | null
  onClose: () => void
}

// Tabbed palette for creating every node type. Opened at the cursor (Tab) or from
// the canvas + button. One accent per category; operators keep their own colors.
export default function AddNodeMenu({ anchor, onClose }: Props) {
  const store = useStore()
  const { screenToFlowPosition } = useReactFlow()
  const [tab, setTab] = useState<NodeCategory>('operators')
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on Escape while open.
  useEffect(() => {
    if (!anchor) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [anchor, onClose])

  // Flow-space position for the new node, anchored at the menu's open point.
  const flowPos = useCallback(() => {
    if (!anchor) return { x: 200, y: 200 }
    const p = screenToFlowPosition({ x: anchor.x, y: anchor.y })
    return { x: p.x, y: p.y }
  }, [anchor, screenToFlowPosition])

  const pickOperator = useCallback((type: typeof OPERATORS[number]['type']) => {
    // Operators apply to an existing sketch: arm the pending-op flow, then the
    // user clicks a sketch to drop the operator onto it.
    store.setPendingToolbarOp(store.pendingToolbarOp === type ? null : type)
    onClose()
  }, [store, onClose])

  const accent = CATEGORY_COLORS[tab]

  if (!anchor) return null

  // Clamp so the panel stays on-screen.
  const left = Math.min(anchor.x, window.innerWidth - MENU_W - 12)
  const top  = Math.min(anchor.y, window.innerHeight - 360)

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }} />
      <div ref={rootRef} className="nodrag nopan"
        style={{
          position: 'fixed', left, top, width: MENU_W, zIndex: 61,
          background: '#0f0f0f', border: '1px solid #333', borderRadius: 4,
          boxShadow: '0 8px 30px rgba(0,0,0,0.7)', overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderBottom: '1px solid #222' }}>
          <Icon name="add" size={12} />
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', color: '#c0c0c0', textTransform: 'uppercase' }}>Add node</span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #222' }}>
          {CATEGORY_ORDER.map((c) => {
            const on = tab === c
            const dot = CATEGORY_COLORS[c]
            return (
              <button key={c} onClick={() => setTab(c)}
                style={{
                  flex: 1, padding: '5px 0 4px', border: 'none', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  background: on ? '#1a1a1a' : 'transparent',
                  borderBottom: on ? `2px solid ${dot}` : '2px solid transparent',
                  transition: 'all 0.1s',
                }}
                title={CATEGORY_LABELS[c]}
              >
                <span style={{ width: 7, height: 7, borderRadius: 2, background: on ? dot : '#444' }} />
                <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: on ? '#d0d0d0' : '#555', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  {CATEGORY_LABELS[c].slice(0, 4)}
                </span>
              </button>
            )
          })}
        </div>

        {/* Entries */}
        <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 300, overflowY: 'auto' }}>
          {tab === 'operators' && OPERATORS.map((op) => (
            <Entry key={op.type} icon={op.icon} label={op.label} color={op.color}
              onClick={() => pickOperator(op.type)} />
          ))}

          {tab === 'sketches' && SKETCHES.map((sk) => (
            <Entry key={sk.library} icon="code-editor" label={sk.label} color={accent}
              onClick={() => { store.addSketchNode({ library: sk.library, position: flowPos() }); onClose() }} />
          ))}

          {(tab === 'generators' || tab === 'inputs' || tab === 'effects') && (
            <>
              {tab === 'effects' && (
                <Entry icon="feedback" label="Feedback loop" color={accent}
                  onClick={() => { store.addFeedbackNode({ position: flowPos() }); onClose() }} />
              )}
              {SOURCES.filter((s) => s.category === tab).map((s) => (
                <Entry key={s.sourceType} icon={s.sourceType} label={s.label} color={accent}
                  onClick={() => { store.addSourceNode({ sourceType: s.sourceType, position: flowPos() }); onClose() }} />
              ))}
            </>
          )}
        </div>

        {/* Footer: clear canvas */}
        <div style={{ borderTop: '1px solid #222', padding: 6 }}>
          <button
            onClick={() => { if (window.confirm('Reset canvas? All nodes and edges will be removed.')) { store.resetCanvas(); onClose() } }}
            style={{ width: '100%', padding: '4px 0', background: 'transparent', border: '1px solid #2a2a2a', borderRadius: 3, color: '#ef4444', fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer' }}
          >× clear canvas</button>
        </div>
      </div>
    </>
  )
}

function Entry({ icon, label, color, onClick }: { icon: string; label: string; color: string; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', width: '100%', textAlign: 'left',
        border: `1px solid ${hov ? color : '#2a2a2a'}`, borderRadius: 3,
        background: hov ? `color-mix(in srgb, ${color} 12%, transparent)` : 'transparent',
        color: hov ? color : '#9a9a9a',
        fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.1s',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, flexShrink: 0, border: `2px solid ${color}`, borderRadius: 2, color }}>
        <Icon name={icon} size={10} />
      </span>
      {label}
    </button>
  )
}
