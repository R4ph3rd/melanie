/**
 * Canvas - the main ReactFlow workspace.
 *
 * New behaviours:
 *  • onConnectEnd: when a connector is dragged to empty space, a floating
 *    "ops menu" appears at the drop position (Modify / Extract / Duplicate).
 *  • onConnect: when a connector lands on another sketch node, a small
 *    Merge / Diff chooser appears instead of adding a bare edge.
 *  • Edges with data.kind === 'param-transfer' are rendered as a thin dashed
 *    gray line (background style, not an arrow).
 *  • OpsToolbar panel (top-left) and a merge-mode toast are rendered here.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type NodeTypes,
  type Connection,
  type OnConnectStartParams,
  ConnectionMode,
  MarkerType,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { nanoid } from 'nanoid'
import Icon from './ui/Icon'
import { useStore } from '../store/store'
import SketchNode from './nodes/SketchNode'
import OperatorNode from './nodes/OperatorNode'
import OpsToolbar from './OpsToolbar'
import SketchPreview from './SketchPreview'
import { EXAMPLE_DRAG_MIME } from './ExamplesPanel'
import { EXAMPLE_SKETCHES } from '../utils/templates'
import type { OperatorType } from '../utils/types'

// ─── Node types ───────────────────────────────────────────────────────────────

const nodeTypes: NodeTypes = {
  sketch:   SketchNode,
  operator: OperatorNode,
}

// ─── Op menu definitions ──────────────────────────────────────────────────────

interface OpMenuEntry {
  type: OperatorType
  label: string
  icon: string
  color: string
}

const CONN_OPS: OpMenuEntry[] = [
  { type: 'modify',    label: 'Modify',    icon: 'modify',    color: '#8C49DF' },
  { type: 'extract',   label: 'Extract',   icon: 'extract',   color: '#b45309' },
  { type: 'duplicate', label: 'Duplicate', icon: 'duplicate', color: '#4b5563' },
  { type: 'merge',     label: 'Merge',     icon: 'merge',     color: '#1d4ed8' },
  { type: 'diff',      label: 'Diff',      icon: 'diff',      color: '#047857' },
]

const MERGE_OPS: OpMenuEntry[] = [
  { type: 'merge', label: 'Merge', icon: 'merge', color: '#1d4ed8' },
  { type: 'diff',  label: 'Diff',  icon: 'diff',  color: '#047857' },
]

// ─── Canvas ───────────────────────────────────────────────────────────────────

export default function Canvas() {
  const nodes         = useStore((s) => s.nodes)
  const edges         = useStore((s) => s.edges)
  const onNodesChange = useStore((s) => s.onNodesChange)
  const onEdgesChange = useStore((s) => s.onEdgesChange)
  const store         = useStore()
  const { screenToFlowPosition } = useReactFlow()

  // Floating menu that appears after dragging a connector to empty space
  const [connOpsMenu, setConnOpsMenu] = useState<{
    screenX: number; screenY: number
    sourceNodeId: string
  } | null>(null)

  // Inline Merge/Diff chooser after sketch→sketch direct connection
  const [mergeMenu, setMergeMenu] = useState<{
    screenX: number; screenY: number
    sourceNodeId: string; targetNodeId: string
  } | null>(null)

  // Track last pointer position for merge menu placement
  const lastPtr = useRef({ x: 0, y: 0 })
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    lastPtr.current = { x: e.clientX, y: e.clientY }
  }, [])

  // Refs used to coordinate onConnectStart → onConnect → onConnectEnd
  const draggingFromNode  = useRef<{ nodeId: string; nodeType: string } | null>(null)
  const connectionMade    = useRef(false)
  // Guard: prevents onPaneClick from clearing a menu that was just opened by onConnectEnd
  const suppressNextPaneClick = useRef(false)

  // ── Connection start: record which node the drag began from ───────────────
  const handleConnectStart = useCallback(
    (_: MouseEvent | TouchEvent, params: OnConnectStartParams) => {
      connectionMade.current = false
      if (!params.nodeId) { draggingFromNode.current = null; return }
      const node = nodes.find((n) => n.id === params.nodeId)
      draggingFromNode.current = node
        ? { nodeId: node.id, nodeType: node.type ?? '' }
        : null
    },
    [nodes],
  )

  // ── Connection end: if no valid connection was made → show ops menu ───────
  const handleConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const from      = draggingFromNode.current
      const completed = connectionMade.current
      draggingFromNode.current = null
      connectionMade.current   = false

      if (!from || from.nodeType !== 'sketch' || completed) return

      const { clientX, clientY } =
        'clientX' in event
          ? { clientX: (event as MouseEvent).clientX, clientY: (event as MouseEvent).clientY }
          : {
              clientX: (event as TouchEvent).changedTouches[0].clientX,
              clientY: (event as TouchEvent).changedTouches[0].clientY,
            }

      // Raise the guard so the onPaneClick that fires on the same mouseup
      // doesn't immediately clear the menu we just opened.
      suppressNextPaneClick.current = true
      setTimeout(() => { suppressNextPaneClick.current = false }, 300)

      setConnOpsMenu({ screenX: clientX, screenY: clientY, sourceNodeId: from.nodeId })
    },
    [],
  )

  // ── Connect: sketch → sketch → show Merge/Diff chooser ───────────────────
  const handleConnect = useCallback(
    (connection: Connection) => {
      connectionMade.current = true
      if (!connection.source || !connection.target) return
      const srcNode = nodes.find((n) => n.id === connection.source)
      const tgtNode = nodes.find((n) => n.id === connection.target)

      if (srcNode?.type === 'sketch' && tgtNode?.type === 'sketch') {
        // Don't add edge yet : show merge/diff chooser
        setMergeMenu({
          screenX:      lastPtr.current.x,
          screenY:      lastPtr.current.y,
          sourceNodeId: connection.source,
          targetNodeId: connection.target,
        })
        return
      }
      // Non-sketch connection: just add the edge normally
      store.addEdge({ id: nanoid(6), ...connection })
    },
    [nodes, store],
  )

  // ── Apply a connection-based op (from empty-space drop menu) ──────────────
  const applyConnOp = useCallback(
    (op: OperatorType, sourceNodeId: string, dropX: number, dropY: number) => {
      setConnOpsMenu(null)

      // Merge and Diff need a second sketch : enter pick mode, same as toolbar
      if (op === 'merge' || op === 'diff') {
        store.setMergingSourceId(sourceNodeId, op)
        return
      }

      const flowPos     = screenToFlowPosition({ x: dropX, y: dropY })
      const sourceNode  = nodes.find((n) => n.id === sourceNodeId)
      const sourceData  = sourceNode?.type === 'sketch' ? sourceNode.data : null
      if (!sourceData) return

      const opX = flowPos.x
      const opY = flowPos.y

      if (op === 'duplicate') {
        const newId = store.addSketchNode({
          code: sourceData.code as string,
          library: sourceData.library as 'p5js' | 'threejs',
          position: { x: opX + 300, y: opY },
          title: (sourceData.title as string) + ' copy',
        })
        const opId = store.addOperatorNode({
          operatorType: 'duplicate', sourceNodeIds: [sourceNodeId],
          position: { x: opX, y: opY },
        })
        store.updateOperator(opId, { targetNodeId: newId })
        store.addEdge({ id: nanoid(6), source: sourceNodeId, target: opId,  sourceHandle: 'right' })
        store.addEdge({ id: nanoid(6), source: opId,         target: newId, targetHandle: 'left'  })
        return
      }

      const targetId = store.addSketchNode({
        code: '', library: sourceData.library as 'p5js' | 'threejs',
        position: { x: opX + 340, y: opY },
        title: store.nextSketchTitle(),
      })
      const opId = store.addOperatorNode({
        operatorType: op, sourceNodeIds: [sourceNodeId],
        position: { x: opX, y: opY },
      })
      store.updateOperator(opId, { targetNodeId: targetId })
      store.addEdge({ id: nanoid(6), source: sourceNodeId, target: opId,      sourceHandle: 'right' })
      store.addEdge({ id: nanoid(6), source: opId,         target: targetId,  targetHandle: 'left'  })
    },
    [nodes, store, screenToFlowPosition],
  )

  // ── Apply merge/diff (from sketch→sketch direct drag) ─────────────────────
  const applyMergeOp = useCallback(
    (op: 'merge' | 'diff', srcId: string, tgtId: string) => {
      setMergeMenu(null)
      const pos1 = store.getNodePosition(srcId)
      const pos2 = store.getNodePosition(tgtId)
      const opX  = ((pos1?.x ?? 0) + (pos2?.x ?? 0)) / 2 + 140
      const opY  = ((pos1?.y ?? 0) + (pos2?.y ?? 0)) / 2 + 100
      const tgtNode = nodes.find((n) => n.id === tgtId)
      const library = tgtNode?.type === 'sketch' ? (tgtNode.data.library as 'p5js' | 'threejs') : 'p5js'

      if (op === 'diff') {
        const opId = store.addOperatorNode({
          operatorType: 'diff', sourceNodeIds: [srcId, tgtId],
          position: { x: opX, y: opY },
        })
        store.addEdge({ id: nanoid(6), source: srcId, target: opId, sourceHandle: 'right' })
        store.addEdge({ id: nanoid(6), source: tgtId, target: opId, sourceHandle: 'right' })
        return
      }

      const resultX  = Math.max((pos1?.x ?? 0), (pos2?.x ?? 0)) + 400
      const resultY  = opY - 60
      const resultId = store.addSketchNode({
        code: '', library, position: { x: resultX, y: resultY },
        title: store.nextSketchTitle(),
      })
      const opId = store.addOperatorNode({
        operatorType: 'merge', sourceNodeIds: [srcId, tgtId],
        position: { x: opX, y: opY },
      })
      store.updateOperator(opId, { targetNodeId: resultId })
      store.addEdge({ id: nanoid(6), source: srcId,  target: opId,     sourceHandle: 'right' })
      store.addEdge({ id: nanoid(6), source: tgtId,  target: opId,     sourceHandle: 'right' })
      store.addEdge({ id: nanoid(6), source: opId,   target: resultId, targetHandle: 'left'  })
    },
    [nodes, store],
  )

  // ── Styled edges: normal vs param-transfer ────────────────────────────────
  const styledEdges = useMemo(
    () =>
      edges.map((e) => {
        const isParamTransfer = e.data?.kind === 'param-transfer'
        return {
          ...e,
          style: isParamTransfer
            ? { stroke: '#555', strokeWidth: 1, strokeDasharray: '4 4', opacity: 0.5 }
            : { stroke: '#4a4a6a', strokeWidth: 1.5 },
          markerEnd: isParamTransfer
            ? undefined
            : { type: MarkerType.ArrowClosed, color: '#4a4a6a' },
          animated: false,
          zIndex: isParamTransfer ? -1 : 0,
        }
      }),
    [edges],
  )

  const mergingId         = store.mergingSourceId
  const pendingOpType     = store.pendingOpType
  const backgroundSketchId = store.backgroundSketchId
  const backgroundSketch  = backgroundSketchId
    ? nodes.find((n) => n.id === backgroundSketchId && n.type === 'sketch')
    : null
  const backgroundData    = backgroundSketch?.type === 'sketch' ? backgroundSketch.data : null

  // ── Drag-and-drop from the ExamplesPanel ──────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(EXAMPLE_DRAG_MIME)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])
  const handleDrop = useCallback((e: React.DragEvent) => {
    const sketchId = e.dataTransfer.getData(EXAMPLE_DRAG_MIME)
    if (!sketchId) return
    e.preventDefault()
    const sketch = EXAMPLE_SKETCHES.find((s) => s.id === sketchId)
    if (!sketch) return
    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    store.addSketchNode({
      code:           sketch.code,
      library:        sketch.library,
      position:       { x: flowPos.x - 140, y: flowPos.y - 130 },
      title:          sketch.title,
      semanticLabels: sketch.semanticLabels,
    })
  }, [screenToFlowPosition, store])

  // Track viewport size so the background iframe fills it.
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

  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-full"
      onPointerMove={handlePointerMove}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Background sketch : fills the whole canvas, sits behind ReactFlow */}
      {backgroundData && viewportSize.w > 0 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 0, opacity: 0.55 }}
        >
          <SketchPreview
            code={backgroundData.code as string}
            library={backgroundData.library as 'p5js' | 'threejs'}
            isRunning={backgroundData.isRunning as boolean}
            generationKey={(backgroundData.generationKey as number) ?? 0}
            width={viewportSize.w}
            height={viewportSize.h}
          />
        </div>
      )}

      {/* Merge/toolbar-op mode toast */}
      {(mergingId || store.pendingToolbarOp) && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded text-sm font-medium pointer-events-none"
          style={{ background: 'rgba(29,78,216,0.9)', color: '#fff', backdropFilter: 'blur(4px)' }}
        >
          {pendingOpType === 'diff'
            ? '⊟ Click another sketch to compare'
            : mergingId
            ? '⊕ Click another sketch to merge'
            : `${store.pendingToolbarOp} — click a sketch node`}
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        onPaneClick={() => {
          if (suppressNextPaneClick.current) return
          setConnOpsMenu(null)
          setMergeMenu(null)
          store.setPendingToolbarOp(null)
          store.setDraggingParam(null)
        }}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        style={{ background: backgroundData ? 'transparent' : '#080808' }}
        deleteKeyCode="Delete"
      >
        {!backgroundData && (
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1e1e2e" />
        )}
        <Controls style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 3 }} />
        <MiniMap
          style={{ background: '#0e0e16', border: '1px solid #2a2a3a' }}
          nodeColor={(n) => n.type === 'sketch' ? '#1a1f2e' : '#1c1428'}
          maskColor="rgba(8,8,8,0.7)"
        />
        <OpsToolbar />
      </ReactFlow>

      {/* ── Floating connection ops menu (empty-space drop) ── */}
      {connOpsMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setConnOpsMenu(null)} />
          <div
            className="fixed z-50"
            style={{
              left: connOpsMenu.screenX, top: connOpsMenu.screenY,
              transform: 'translate(-50%, 8px)',
              background: '#111', border: '1px solid #333', borderRadius: 4,
              padding: 6, minWidth: 148,
              boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{
              padding: '2px 10px 4px', marginBottom: 4,
              fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
              color: '#555', textTransform: 'uppercase',
              borderBottom: '1px solid #2a2a2a',
            }}>
              Add operation
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {CONN_OPS.map((op) => (
                <button
                  key={op.type}
                  onClick={() => applyConnOp(op.type, connOpsMenu.sourceNodeId, connOpsMenu.screenX, connOpsMenu.screenY)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 10px', width: '100%', textAlign: 'left',
                    border: '1px solid #2a2a2a', borderRadius: 3,
                    background: 'transparent', color: '#707070',
                    fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', transition: 'all 0.1s',
                  }}
                >
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 22, height: 22, flexShrink: 0,
                    border: `2px solid ${op.color}`, borderRadius: 2, color: op.color,
                  }}>
                    <Icon name={op.icon} size={10} />
                  </span>
                  {op.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setConnOpsMenu(null)}
              style={{
                marginTop: 4, width: '100%', padding: '3px 0',
                background: 'transparent', border: 'none',
                color: '#555', fontSize: 11, fontFamily: 'var(--font-mono)',
                cursor: 'pointer', textAlign: 'center',
              }}
            >
              × cancel
            </button>
          </div>
        </>
      )}

      {/* ── Merge / Diff chooser (sketch→sketch drag) ── */}
      {mergeMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMergeMenu(null)} />
          <div
            className="fixed z-50"
            style={{
              left: mergeMenu.screenX, top: mergeMenu.screenY,
              transform: 'translate(-50%, 8px)',
              background: '#111', border: '1px solid #333', borderRadius: 4,
              padding: 6, minWidth: 148,
              boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{
              padding: '2px 10px 4px', marginBottom: 4,
              fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
              color: '#555', textTransform: 'uppercase',
              borderBottom: '1px solid #2a2a2a',
            }}>
              Two sketches…
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {MERGE_OPS.map((op) => (
                <button
                  key={op.type}
                  onClick={() => applyMergeOp(op.type as 'merge' | 'diff', mergeMenu.sourceNodeId, mergeMenu.targetNodeId)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 10px', width: '100%', textAlign: 'left',
                    border: '1px solid #2a2a2a', borderRadius: 3,
                    background: 'transparent', color: '#707070',
                    fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', transition: 'all 0.1s',
                  }}
                >
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 22, height: 22, flexShrink: 0,
                    border: `2px solid ${op.color}`, borderRadius: 2, color: op.color,
                  }}>
                    <Icon name={op.icon} size={10} />
                  </span>
                  {op.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setMergeMenu(null)}
              style={{
                marginTop: 4, width: '100%', padding: '3px 0',
                background: 'transparent', border: 'none',
                color: '#555', fontSize: 11, fontFamily: 'var(--font-mono)',
                cursor: 'pointer', textAlign: 'center',
              }}
            >
              × cancel
            </button>
          </div>
        </>
      )}
    </div>
  )
}
