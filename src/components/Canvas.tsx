import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, Background, BackgroundVariant, Panel, MiniMap,
  type NodeTypes, type Connection, type OnConnectStartParams, type Edge,
  ConnectionMode, MarkerType, useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { nanoid } from 'nanoid'
import Icon from './ui/Icon'
import { useStore } from '../store/store'
import SketchNode from './nodes/SketchNode'
import OperatorNode from './nodes/OperatorNode'
import SourceNode from './nodes/SourceNode'
import FeedbackNode from './nodes/FeedbackNode'
import AddNodeMenu from './AddNodeMenu'
import SketchPreview from './SketchPreview'
import ContactSheet from './ContactSheet'
import FeedbackBridge from './FeedbackBridge'
import { EXAMPLE_DRAG_MIME } from './ExamplesPanel'
import { EXAMPLE_SKETCHES } from '../utils/templates'
import type { OperatorType, SourceType } from '../utils/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface OpMenuEntry { type: OperatorType; label: string; icon: string; color: string }

const nodeTypes: NodeTypes = { sketch: SketchNode, operator: OperatorNode, source: SourceNode, feedback: FeedbackNode }

const CONN_OPS: OpMenuEntry[] = [
  { type: 'modify',    label: 'Modify',  icon: 'modify',    color: '#8C49DF' },
  { type: 'extract',   label: 'Extract', icon: 'extract',   color: '#b45309' },
  { type: 'duplicate', label: 'Clone',   icon: 'duplicate', color: '#ca8a04' },
  { type: 'merge',     label: 'Merge',   icon: 'merge',     color: '#1d4ed8' },
  { type: 'diff',      label: 'Diff',    icon: 'diff',      color: '#047857' },
]
const MERGE_OPS: OpMenuEntry[] = [
  { type: 'merge', label: 'Merge', icon: 'merge', color: '#1d4ed8' },
  { type: 'diff',  label: 'Diff',  icon: 'diff',  color: '#047857' },
]

// ── Sub-components ────────────────────────────────────────────────────────────

const CanvasControls = memo(function CanvasControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const [hov, setHov] = useState<string | null>(null)
  const btns = [
    { id: 'zoom-in',     title: 'Zoom in',  action: () => zoomIn() },
    { id: 'zoom-out',    title: 'Zoom out', action: () => zoomOut() },
    { id: 'zoom-to-fit', title: 'Fit view', action: () => fitView({ padding: 0.15, duration: 300 }) },
  ]
  return (
    <Panel position="bottom-left" style={{ marginBottom: 8, marginLeft: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, background: '#111', border: '1px solid #2a2a2a', borderRadius: 2, padding: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
        {btns.map((b) => (
          <button key={b.id} onClick={b.action} title={b.title} className="nodrag"
            onMouseEnter={() => setHov(b.id)} onMouseLeave={() => setHov(null)}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 2, border: '2px solid #333', background: hov === b.id ? 'rgba(255,255,255,0.07)' : 'transparent', color: '#555', cursor: 'pointer', transition: 'all 0.1s' }}>
            <Icon name={b.id} size={14} />
          </button>
        ))}
      </div>
    </Panel>
  )
})

const MenuOpButton = memo(function MenuOpButton({ op, onClick }: { op: OpMenuEntry; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', width: '100%', textAlign: 'left',
        border: `1px solid ${hov ? op.color : '#2a2a2a'}`, borderRadius: 3,
        background: hov ? `color-mix(in srgb, ${op.color} 10%, transparent)` : 'transparent',
        color: hov ? op.color : '#707070',
        fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500,
        cursor: 'pointer', transition: 'all 0.1s',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, flexShrink: 0, border: `2px solid ${op.color}`, borderRadius: 2, color: op.color }}>
        <Icon name={op.icon} size={10} />
      </span>
      {op.label}
    </button>
  )
})

// Shared floating menu wrapper used by both op-pick and merge/diff choosers.
function FloatingMenu({ x, y, title, onClose, children }: {
  x: number; y: number; title: string; onClose: () => void; children: React.ReactNode
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed z-50" style={{ left: x, top: y, transform: 'translate(-50%, 8px)', background: '#111', border: '1px solid #333', borderRadius: 2, padding: 6, minWidth: 148, boxShadow: '0 4px 20px rgba(0,0,0,0.6)' }}>
        <div style={{ padding: '2px 10px 4px', marginBottom: 4, fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', color: '#555', textTransform: 'uppercase', borderBottom: '1px solid #2a2a2a' }}>
          {title}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{children}</div>
        <button onClick={onClose} style={{ marginTop: 4, width: '100%', padding: '3px 0', background: 'transparent', border: 'none', color: '#555', fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer', textAlign: 'center' }}>
          × cancel
        </button>
      </div>
    </>
  )
}

// ── Canvas ────────────────────────────────────────────────────────────────────

export default function Canvas() {
  const nodes         = useStore((s) => s.nodes)
  const edges         = useStore((s) => s.edges)
  const onNodesChange    = useStore((s) => s.onNodesChange)
  const onEdgesChangeRaw = useStore((s) => s.onEdgesChange)
  const store         = useStore()
  const onEdgesChange    = useCallback((changes: Parameters<typeof onEdgesChangeRaw>[0]) => {
    // When a signal edge is deleted, also remove its binding.
    for (const c of changes) {
      if (c.type === 'remove') {
        const edge = edges.find((e) => e.id === c.id)
        if (edge?.data?.kind === 'signal' && edge.data.bindingId) {
          store.removeSignalBinding(edge.data.bindingId as string)
        }
      }
    }
    onEdgesChangeRaw(changes)
  }, [edges, onEdgesChangeRaw, store])
  const { screenToFlowPosition } = useReactFlow()

  const [connOpsMenu,       setConnOpsMenu]       = useState<{ screenX: number; screenY: number; sourceNodeId: string } | null>(null)
  const [mergeMenu,         setMergeMenu]         = useState<{ screenX: number; screenY: number; sourceNodeId: string; targetNodeId: string } | null>(null)
  const [signalConnectMenu, setSignalConnectMenu] = useState<{ screenX: number; screenY: number; sourceNodeId: string; channel: string; targetNodeId: string } | null>(null)
  const [addMenu,           setAddMenu]           = useState<{ x: number; y: number } | null>(null)

  const lastPtr               = useRef({ x: 0, y: 0 })
  const draggingFromNode      = useRef<{ nodeId: string; nodeType: string; handleId: string | null } | null>(null)
  const connectionMade        = useRef(false)
  const suppressNextPaneClick = useRef(false)
  const edgeReconnected       = useRef(false)

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    lastPtr.current = { x: e.clientX, y: e.clientY }
  }, [])

  const handleConnectStart = useCallback(
    (_: MouseEvent | TouchEvent, params: OnConnectStartParams) => {
      connectionMade.current = false
      if (!params.nodeId) { draggingFromNode.current = null; return }
      const node = nodes.find((n) => n.id === params.nodeId)
      draggingFromNode.current = node ? { nodeId: node.id, nodeType: node.type ?? '', handleId: params.handleId ?? null } : null
    },
    [nodes],
  )

  const handleConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const from      = draggingFromNode.current
      const completed = connectionMade.current
      draggingFromNode.current = null
      connectionMade.current   = false
      // Only the data-out handle offers operators; signal handles don't.
      if (!from || from.nodeType !== 'sketch' || completed || from.handleId === 'sig-out' || from.handleId === 'sig-in') return

      const { clientX, clientY } = 'clientX' in event
        ? event as MouseEvent
        : { clientX: (event as TouchEvent).changedTouches[0].clientX, clientY: (event as TouchEvent).changedTouches[0].clientY }

      suppressNextPaneClick.current = true
      setTimeout(() => { suppressNextPaneClick.current = false }, 300)
      setConnOpsMenu({ screenX: clientX, screenY: clientY, sourceNodeId: from.nodeId })
    },
    [],
  )

  const handleConnect = useCallback(
    (connection: Connection) => {
      connectionMade.current = true
      if (!connection.source || !connection.target) return
      const srcNode = nodes.find((n) => n.id === connection.source)
      const tgtNode = nodes.find((n) => n.id === connection.target)
      if (srcNode?.type === 'sketch' && tgtNode?.type === 'sketch') {
        // Sketch signal-out → signal-in: a live data passthrough of every channel
        // the source sketch emits via output(). Drawn as a marching-dash signal edge.
        if (connection.sourceHandle === 'sig-out' || connection.targetHandle === 'sig-in') {
          store.addEdge({ id: `sigx-${nanoid(6)}`, ...connection, data: { kind: 'signal' } })
          return
        }
        setMergeMenu({ screenX: lastPtr.current.x, screenY: lastPtr.current.y, sourceNodeId: connection.source, targetNodeId: connection.target })
        return
      }
      if (srcNode?.type === 'source' && tgtNode?.type === 'sketch') {
        setSignalConnectMenu({ screenX: lastPtr.current.x, screenY: lastPtr.current.y, sourceNodeId: connection.source, channel: connection.sourceHandle ?? 'value', targetNodeId: connection.target })
        return
      }
      // Feedback edges are an intentional cycle (sketch → feedback → sketch); tag
      // them so cycle detection skips them and they render as a live loop.
      if (srcNode?.type === 'feedback' || tgtNode?.type === 'feedback') {
        store.addEdge({ id: nanoid(6), ...connection, data: { kind: 'feedback' } })
        return
      }
      store.addEdge({ id: nanoid(6), ...connection })
    },
    [nodes, store],
  )

  const handleReconnectStart = useCallback(() => {
    edgeReconnected.current = false
  }, [])

  const handleReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      edgeReconnected.current = true
      if (oldEdge.data?.kind === 'signal' && oldEdge.data?.bindingId) {
        store.removeSignalBinding(oldEdge.data.bindingId as string)
      }
      onEdgesChangeRaw([{ type: 'remove', id: oldEdge.id }])
      const edgeData = oldEdge.data?.bindingId
        ? { kind: oldEdge.data.kind }
        : oldEdge.data
      store.addEdge({
        id: nanoid(6),
        source: newConnection.source!,
        target: newConnection.target!,
        sourceHandle: newConnection.sourceHandle ?? undefined,
        targetHandle: newConnection.targetHandle ?? undefined,
        data: edgeData as Record<string, unknown> | undefined,
      })
    },
    [store, onEdgesChangeRaw],
  )

  const handleReconnectEnd = useCallback(
    (_: MouseEvent | TouchEvent, edge: Edge) => {
      if (!edgeReconnected.current) {
        if (edge.data?.kind === 'signal' && edge.data?.bindingId) {
          store.removeSignalBinding(edge.data.bindingId as string)
        }
        onEdgesChangeRaw([{ type: 'remove', id: edge.id }])
      }
    },
    [store, onEdgesChangeRaw],
  )

  const applyConnOp = useCallback(
    (op: OperatorType, sourceNodeId: string, dropX: number, dropY: number) => {
      setConnOpsMenu(null)
      if (op === 'merge' || op === 'diff') {
        store.setMergingSourceId(sourceNodeId, op)
        return
      }
      const flowPos    = screenToFlowPosition({ x: dropX, y: dropY })
      const sourceNode = nodes.find((n) => n.id === sourceNodeId)
      const sourceData = sourceNode?.type === 'sketch' ? sourceNode.data : null
      if (!sourceData) return
      const { x: opX, y: opY } = flowPos

      if (op === 'duplicate') {
        const newId = store.addSketchNode({ code: sourceData.code as string, library: sourceData.library as 'p5js' | 'threejs', position: { x: opX + 300, y: opY }, title: (sourceData.title as string) + ' copy' })
        const opId  = store.addOperatorNode({ operatorType: 'duplicate', sourceNodeIds: [sourceNodeId], position: { x: opX, y: opY } })
        store.updateOperator(opId, { targetNodeId: newId })
        store.addEdge({ id: nanoid(6), source: sourceNodeId, target: opId,  sourceHandle: 'right' })
        store.addEdge({ id: nanoid(6), source: opId,         target: newId, targetHandle: 'left'  })
        return
      }
      const targetId = store.addSketchNode({ code: '', library: sourceData.library as 'p5js' | 'threejs', position: { x: opX + 340, y: opY }, title: store.nextSketchTitle() })
      const opId     = store.addOperatorNode({ operatorType: op, sourceNodeIds: [sourceNodeId], position: { x: opX, y: opY } })
      store.updateOperator(opId, { targetNodeId: targetId })
      store.addEdge({ id: nanoid(6), source: sourceNodeId, target: opId,     sourceHandle: 'right' })
      store.addEdge({ id: nanoid(6), source: opId,         target: targetId, targetHandle: 'left'  })
    },
    [nodes, store, screenToFlowPosition],
  )

  const applyMergeOp = useCallback(
    (op: 'merge' | 'diff', srcId: string, tgtId: string) => {
      setMergeMenu(null)
      const pos1    = store.getNodePosition(srcId)
      const pos2    = store.getNodePosition(tgtId)
      const opX     = ((pos1?.x ?? 0) + (pos2?.x ?? 0)) / 2 + 140
      const opY     = ((pos1?.y ?? 0) + (pos2?.y ?? 0)) / 2 + 100
      const tgtNode = nodes.find((n) => n.id === tgtId)
      const library = tgtNode?.type === 'sketch' ? (tgtNode.data.library as 'p5js' | 'threejs') : 'p5js'

      if (op === 'diff') {
        const opId = store.addOperatorNode({ operatorType: 'diff', sourceNodeIds: [srcId, tgtId], position: { x: opX, y: opY } })
        store.addEdge({ id: nanoid(6), source: srcId, target: opId, sourceHandle: 'right' })
        store.addEdge({ id: nanoid(6), source: tgtId, target: opId, sourceHandle: 'right' })
        return
      }
      const resultId = store.addSketchNode({ code: '', library, position: { x: Math.max((pos1?.x ?? 0), (pos2?.x ?? 0)) + 400, y: opY - 60 }, title: store.nextSketchTitle() })
      const opId     = store.addOperatorNode({ operatorType: 'merge', sourceNodeIds: [srcId, tgtId], position: { x: opX, y: opY } })
      store.updateOperator(opId, { targetNodeId: resultId })
      store.addEdge({ id: nanoid(6), source: srcId, target: opId,     sourceHandle: 'right' })
      store.addEdge({ id: nanoid(6), source: tgtId, target: opId,     sourceHandle: 'right' })
      store.addEdge({ id: nanoid(6), source: opId,  target: resultId, targetHandle: 'left'  })
    },
    [nodes, store],
  )

  const styledEdges = useMemo(
    () => edges.map((e) => {
      const kind = e.data?.kind
      if (kind === 'signal') {
        // Sketch→sketch passthrough: white/light dashes matching the handle color.
        // Source→param bindings keep the blue accent so they're visually distinct.
        const isPassthrough = !e.data?.bindingId
        return {
          ...e,
          style: { stroke: isPassthrough ? '#c8c8c8' : '#0ea5e9', strokeWidth: 1.5, strokeDasharray: '6 3' },
          animated: true,
          zIndex: 0,
          reconnectable: true,
        }
      }
      if (kind === 'feedback') return {
        ...e,
        style: { stroke: '#f97316', strokeWidth: 1.5, strokeDasharray: '2 3' },
        animated: true,
        zIndex: 0,
        reconnectable: true,
      }
      if (kind === 'param-transfer') return {
        ...e,
        style: { stroke: '#555', strokeWidth: 1, strokeDasharray: '4 4', opacity: 0.5 },
        animated: false,
        zIndex: 0,
      }
      return {
        ...e,
        style: { stroke: '#4a4a6a', strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#4a4a6a' },
        animated: false,
        zIndex: 0,
        reconnectable: true,
      }
    }),
    [edges],
  )

  const mergingId          = store.mergingSourceId
  const pendingOpType      = store.pendingOpType
  const backgroundSketchId = store.backgroundSketchId
  const backgroundSketch   = backgroundSketchId ? nodes.find((n) => n.id === backgroundSketchId && n.type === 'sketch') : null
  const backgroundData     = backgroundSketch?.type === 'sketch' ? backgroundSketch.data : null

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(EXAMPLE_DRAG_MIME)) {
      e.preventDefault(); e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    const sketchId = e.dataTransfer.getData(EXAMPLE_DRAG_MIME)
    if (!sketchId) return
    e.preventDefault()
    const sketch = EXAMPLE_SKETCHES.find((s) => s.id === sketchId)
    if (!sketch) return
    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    store.addSketchNode({ code: sketch.code, library: sketch.library, position: { x: flowPos.x - 140, y: flowPos.y - 130 }, title: sketch.title, semanticLabels: sketch.semanticLabels })
  }, [screenToFlowPosition, store])

  const wrapperRef = useRef<HTMLDivElement>(null)
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const update = () => {
      const r = wrapperRef.current?.getBoundingClientRect()
      if (r) setViewportSize({ w: Math.ceil(r.width), h: Math.ceil(r.height) })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Tab opens the add-node menu at the cursor (unless typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.closest('.cm-editor'))) return
      e.preventDefault()
      setAddMenu((m) => (m ? null : { x: lastPtr.current.x, y: lastPtr.current.y }))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div ref={wrapperRef} className="relative w-full h-full"
      onPointerMove={handlePointerMove} onDragOver={handleDragOver} onDrop={handleDrop}
    >
      {backgroundData && viewportSize.w > 0 && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0, opacity: 0.55 }}>
          <SketchPreview
            code={backgroundData.code as string} library={backgroundData.library as 'p5js' | 'threejs'}
            isRunning={backgroundData.isRunning as boolean} generationKey={(backgroundData.generationKey as number) ?? 0}
            width={viewportSize.w} height={viewportSize.h}
          />
        </div>
      )}

      {(mergingId || store.pendingToolbarOp) && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded text-sm font-medium pointer-events-none"
          style={{ background: 'rgba(29,78,216,0.9)', color: '#fff', backdropFilter: 'blur(4px)' }}>
          {pendingOpType === 'diff'
            ? '⊟ Click another sketch to compare'
            : mergingId
            ? '⊕ Click another sketch to merge'
            : `${store.pendingToolbarOp} — click a sketch node`}
        </div>
      )}

      <ReactFlow
        nodes={nodes} edges={styledEdges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onConnect={handleConnect} onConnectStart={handleConnectStart} onConnectEnd={handleConnectEnd}
        onReconnect={handleReconnect} onReconnectStart={handleReconnectStart} onReconnectEnd={handleReconnectEnd}
        onPaneClick={() => {
          if (suppressNextPaneClick.current) return
          setConnOpsMenu(null); setMergeMenu(null)
          store.setPendingToolbarOp(null); store.setDraggingParam(null)
        }}
        nodeTypes={nodeTypes} connectionMode={ConnectionMode.Loose}
        fitView fitViewOptions={{ padding: 0.15 }} minZoom={0.1} maxZoom={2}
        proOptions={{ hideAttribution: true }}
        style={{ background: backgroundData ? 'transparent' : '#080808' }}
        deleteKeyCode="Delete"
      >
        {!backgroundData && <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1e1e2e" />}
        <CanvasControls />
        <MiniMap style={{ background: '#0e0e16', border: '1px solid #2a2a3a' }} nodeColor={(n) => n.type === 'sketch' ? '#1a1f2e' : '#1c1428'} maskColor="rgba(8,8,8,0.7)" />
        <Panel position="top-left" style={{ marginTop: 8, marginLeft: 8 }}>
          <button className="nodrag" title="Add node (Tab)"
            onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setAddMenu({ x: r.left, y: r.bottom + 4 }) }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', background: '#111', border: '1px solid #333', borderRadius: 2, color: '#c0c0c0', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.6)' }}
          >
            <Icon name="add" size={13} /> Add node
            <span style={{ marginLeft: 4, fontSize: 9, fontFamily: 'var(--font-mono)', color: '#555', border: '1px solid #333', borderRadius: 2, padding: '0 4px' }}>Tab</span>
          </button>
        </Panel>
      </ReactFlow>

      {connOpsMenu && (
        <FloatingMenu x={connOpsMenu.screenX} y={connOpsMenu.screenY} title="Add operation" onClose={() => setConnOpsMenu(null)}>
          {CONN_OPS.map((op) => (
            <MenuOpButton key={op.type} op={op} onClick={() => applyConnOp(op.type, connOpsMenu.sourceNodeId, connOpsMenu.screenX, connOpsMenu.screenY)} />
          ))}
        </FloatingMenu>
      )}

      {mergeMenu && (
        <FloatingMenu x={mergeMenu.screenX} y={mergeMenu.screenY} title="Two sketches…" onClose={() => setMergeMenu(null)}>
          {MERGE_OPS.map((op) => (
            <MenuOpButton key={op.type} op={op} onClick={() => applyMergeOp(op.type as 'merge' | 'diff', mergeMenu.sourceNodeId, mergeMenu.targetNodeId)} />
          ))}
        </FloatingMenu>
      )}

      <AddNodeMenu anchor={addMenu} onClose={() => setAddMenu(null)} />
      <FeedbackBridge />
      <ContactSheet />

      {signalConnectMenu && (() => {
        const targetData = store.getSketchNode(signalConnectMenu.targetNodeId)
        const params = (targetData?.parameters ?? []) as import('../utils/types').Parameter[]
        return (
          <FloatingMenu x={signalConnectMenu.screenX} y={signalConnectMenu.screenY} title={`bind "${signalConnectMenu.channel}" to`} onClose={() => setSignalConnectMenu(null)}>
            {params.length === 0 && (
              <p style={{ fontSize: 11, color: '#555', padding: '4px 6px', margin: 0 }}>No parameters on target sketch</p>
            )}
            {params.map((p) => (
              <button key={p.name} onClick={() => {
                const { sourceNodeId, channel, targetNodeId } = signalConnectMenu
                const bindId = store.addSignalBinding({ sourceNodeId, channel, targetNodeId, paramName: p.name })
                store.addEdge({ id: `sig-${bindId}`, source: sourceNodeId, target: targetNodeId, sourceHandle: channel, data: { kind: 'signal', bindingId: bindId } })
                setSignalConnectMenu(null)
              }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', width: '100%', textAlign: 'left', border: '1px solid #2a2a2a', borderRadius: 3, background: 'transparent', color: '#a0a0a0', fontFamily: 'var(--font-sans)', fontSize: 12, cursor: 'pointer', transition: 'all 0.1s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0ea5e9'; e.currentTarget.style.color = '#0ea5e9' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#a0a0a0' }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555' }}>{p.name}</span>
                <span className="truncate">{p.semanticLabel || p.label}</span>
              </button>
            ))}
          </FloatingMenu>
        )
      })()}
    </div>
  )
}
