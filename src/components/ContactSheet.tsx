import { useMemo, useEffect } from 'react'
import { useStore } from '../store/store'
import type { AppNode, SketchNode } from '../utils/types'
import SketchPreview from './SketchPreview'
import Icon from './ui/Icon'

const TILE_W = 240
const TILE_H = 170

// Nearest upstream sketch reached by walking incoming edges (through operators).
function parentSketch(id: string, nodes: AppNode[], incoming: Map<string, string[]>): string | null {
  const isSketch = (nid: string) => nodes.find((n) => n.id === nid)?.type === 'sketch'
  const seen = new Set<string>()
  const queue = [...(incoming.get(id) ?? [])]
  while (queue.length) {
    const cur = queue.shift()!
    if (seen.has(cur)) continue
    seen.add(cur)
    if (isSketch(cur)) return cur
    for (const s of incoming.get(cur) ?? []) queue.push(s)
  }
  return null
}

export default function ContactSheet() {
  const compareNodeId = useStore((s) => s.compareNodeId)
  const close         = useStore((s) => s.setCompareNodeId)
  const setActiveCode = useStore((s) => s.setActiveCodeNodeId)
  const nodes         = useStore((s) => s.nodes)
  const edges         = useStore((s) => s.edges)

  const { family, parentId } = useMemo(() => {
    if (!compareNodeId) return { family: [] as SketchNode[], parentId: null as string | null }
    const incoming = new Map<string, string[]>()
    for (const e of edges) {
      if (!e.source || !e.target) continue
      ;(incoming.get(e.target) ?? incoming.set(e.target, []).get(e.target)!).push(e.source)
    }
    const sketches = nodes.filter((n): n is SketchNode => n.type === 'sketch')
    const parent   = parentSketch(compareNodeId, nodes, incoming)
    const family   = parent
      ? sketches.filter((s) => s.id === parent || parentSketch(s.id, nodes, incoming) === parent)
      : sketches.filter((s) => parentSketch(s.id, nodes, incoming) === null)
    // Parent first, then the rest.
    family.sort((a, b) => (a.id === parent ? -1 : b.id === parent ? 1 : 0))
    return { family, parentId: parent }
  }, [compareNodeId, nodes, edges])

  useEffect(() => {
    if (!compareNodeId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [compareNodeId, close])

  if (!compareNodeId) return null
  const parentTitle = parentId ? (nodes.find((n) => n.id === parentId) as SketchNode | undefined)?.data.title : null

  return (
    <div className="absolute inset-0 z-[60] flex flex-col" style={{ background: 'rgba(6,6,10,0.94)', backdropFilter: 'blur(3px)' }}>
      <div className="flex items-center justify-between flex-shrink-0" style={{ padding: '10px 16px', borderBottom: '1px solid #1e1e1e' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="compare" size={14} style={{ color: '#8C49DF' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e0e0e0' }}>
            {parentTitle ? `Variants of “${parentTitle}”` : 'Root sketches'}
          </span>
          <span style={{ fontSize: 11, color: '#555', fontFamily: 'var(--font-mono)' }}>{family.length} sketches</span>
        </div>
        <button onClick={() => close(null)} title="Close (Esc)"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, border: '1px solid #2a2a2a', borderRadius: 2, background: 'transparent', color: '#888', cursor: 'pointer' }}>
          <Icon name="close" size={13} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {family.length === 0 ? (
          <p style={{ color: '#666', fontSize: 13 }}>No sibling sketches to compare.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${TILE_W}px, 1fr))`, gap: 14 }}>
            {family.map((s) => {
              const isFocus  = s.id === compareNodeId
              const isParent = s.id === parentId
              return (
                <div key={s.id}
                  style={{ background: '#111', border: `1px solid ${isFocus ? '#8C49DF' : '#262626'}`, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '5px 8px', borderBottom: '1px solid #1e1e1e' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#d0d0d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.data.title}</span>
                    {isParent && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#8C49DF', flexShrink: 0 }}>parent</span>}
                  </div>
                  <div style={{ height: TILE_H, background: '#0a0a0a' }}>
                    {s.data.code
                      ? <SketchPreview code={s.data.code} library={s.data.library} isRunning generationKey={s.data.generationKey} width={TILE_W} height={TILE_H} />
                      : <div className="flex items-center justify-center h-full text-xs text-text-muted">empty</div>}
                  </div>
                  <div style={{ padding: '5px 8px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => { setActiveCode(s.id); close(null) }}
                      style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#888', background: 'transparent', border: '1px solid #2a2a2a', borderRadius: 2, padding: '2px 8px', cursor: 'pointer' }}>
                      open code
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
