import { memo, useState, useCallback } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { nanoid } from 'nanoid'
import type { SketchNodeData, OperatorType } from '../../types'
import { useStore } from '../../store'
import SketchPreview from '../SketchPreview'
import ParameterSliders from '../ParameterSliders'

type SketchNodeType = Node<SketchNodeData, 'sketch'>

const PREVIEW_W = 260
const PREVIEW_H = 200

const OP_MENU: { type: OperatorType; label: string; icon: string; color: string }[] = [
  { type: 'modify',    label: 'Modify',    icon: '✦', color: '#7c3aed' },
  { type: 'duplicate', label: 'Duplicate', icon: '⎘', color: '#4b5563' },
  { type: 'merge',     label: 'Merge',     icon: '⊕', color: '#1d4ed8' },
  { type: 'diff',      label: 'Diff',      icon: '⊟', color: '#047857' },
  { type: 'extract',   label: 'Extract',   icon: '⊆', color: '#b45309' },
]

const SketchNode = memo(function SketchNode({ id, data, selected }: NodeProps<SketchNodeType>) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)

  const store = useStore()

  const handleOperation = useCallback(
    (opType: OperatorType) => {
      setMenuOpen(false)
      const pos = store.getNodePosition(id)
      const baseX = (pos?.x ?? 0) + PREVIEW_W + 120
      const baseY = (pos?.y ?? 0)

      if (opType === 'duplicate') {
        const newId = store.addSketchNode({
          code: data.code,
          library: data.library,
          position: { x: baseX + 300, y: baseY },
          title: data.title + ' copy',
        })
        const opId = store.addOperatorNode({
          operatorType: 'duplicate',
          sourceNodeIds: [id],
          position: { x: baseX, y: baseY + 70 },
        })
        store.updateOperator(opId, { targetNodeId: newId })
        store.addEdge({ id: nanoid(6), source: id, target: opId, sourceHandle: 'right' })
        store.addEdge({ id: nanoid(6), source: opId, target: newId, targetHandle: 'left' })
        return
      }

      if (opType === 'merge') {
        store.setMergingSourceId(id, 'merge')
        return
      }

      if (opType === 'diff') {
        store.setMergingSourceId(id, 'diff')
        return
      }

      // modify / extract : create operator + empty target sketch
      const targetId = store.addSketchNode({
        code: '',
        library: data.library,
        position: { x: baseX + 340, y: baseY },
        title: store.nextSketchTitle(),
      })
      const opId = store.addOperatorNode({
        operatorType: opType,
        sourceNodeIds: [id],
        position: { x: baseX, y: baseY + 60 },
      })
      store.updateOperator(opId, { targetNodeId: targetId })
      store.addEdge({ id: nanoid(6), source: id,   target: opId,     sourceHandle: 'right' })
      store.addEdge({ id: nanoid(6), source: opId, target: targetId, targetHandle: 'left'  })
    },
    [id, data, store]
  )

  const handleMergeTarget = useCallback(() => {
    const mergingId = store.mergingSourceId
    const opType    = store.pendingOpType ?? 'merge'
    if (!mergingId || mergingId === id) {
      store.setMergingSourceId(null)
      return
    }
    store.setMergingSourceId(null)
    const pos1 = store.getNodePosition(mergingId)
    const pos2 = store.getNodePosition(id)
    const opX = ((pos1?.x ?? 0) + (pos2?.x ?? 0)) / 2 + 140
    const opY = ((pos1?.y ?? 0) + (pos2?.y ?? 0)) / 2 + 100

    if (opType === 'diff') {
      // Diff: no target sketch, just the operator node
      const opId = store.addOperatorNode({
        operatorType: 'diff',
        sourceNodeIds: [mergingId, id],
        position: { x: opX, y: opY },
      })
      store.addEdge({ id: nanoid(6), source: mergingId, target: opId, sourceHandle: 'right' })
      store.addEdge({ id: nanoid(6), source: id,        target: opId, sourceHandle: 'right' })
      return
    }

    // Merge: create target sketch
    const targetX = Math.max((pos1?.x ?? 0), (pos2?.x ?? 0)) + 400
    const targetY = opY - 60
    const targetId = store.addSketchNode({
      code: '',
      library: data.library,
      position: { x: targetX, y: targetY },
      title: store.nextSketchTitle(),
    })
    const opId = store.addOperatorNode({
      operatorType: 'merge',
      sourceNodeIds: [mergingId, id],
      position: { x: opX, y: opY },
    })
    store.updateOperator(opId, { targetNodeId: targetId })
    store.addEdge({ id: nanoid(6), source: mergingId, target: opId,     sourceHandle: 'right' })
    store.addEdge({ id: nanoid(6), source: id,        target: opId,     sourceHandle: 'right' })
    store.addEdge({ id: nanoid(6), source: opId,      target: targetId, targetHandle: 'left'  })
  }, [id, data.library, store])

  const isMergingTarget = !!store.mergingSourceId && store.mergingSourceId !== id
  const pendingLabel    = store.pendingOpType === 'diff' ? 'Click to diff' : 'Click to merge'

  return (
    <div
      className="sketch-node"
      style={{
        background: '#131825',
        border: selected
          ? '1.5px solid #7c3aed'
          : isMergingTarget
          ? '1.5px dashed #1d4ed8'
          : '1px solid #2a2a3a',
        borderRadius: 8,
        boxShadow: selected ? '0 0 0 3px rgba(124,58,237,0.2), 0 4px 24px rgba(0,0,0,0.6)' : '0 4px 24px rgba(0,0,0,0.5)',
        minWidth: PREVIEW_W + 20,
        cursor: isMergingTarget ? 'crosshair' : 'default',
      }}
      onClick={isMergingTarget ? handleMergeTarget : undefined}
    >
      {/* Handles */}
      <Handle type="target" position={Position.Left}  id="left"  style={{ background: '#7c3aed', width: 10, height: 10 }} />
      <Handle type="source" position={Position.Right} id="right" style={{ background: '#7c3aed', width: 10, height: 10 }} />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        {editingTitle ? (
          <input
            autoFocus
            defaultValue={data.title}
            onBlur={(e) => { store.updateSketchTitle(id, e.target.value); setEditingTitle(false) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { store.updateSketchTitle(id, e.currentTarget.value); setEditingTitle(false) } }}
            className="bg-surface3 text-text-primary text-sm font-medium rounded px-1 w-32 outline-none border border-accent"
          />
        ) : (
          <span
            className="text-sm font-medium text-text-primary cursor-pointer hover:text-accent"
            onDoubleClick={() => setEditingTitle(true)}
          >
            {data.title}
          </span>
        )}
        <div className="flex items-center gap-1">
          <span
            className="text-2xs px-1.5 py-0.5 rounded"
            style={{
              background: data.library === 'p5js' ? '#1a2a1a' : '#1a1a2e',
              color: data.library === 'p5js' ? '#4ade80' : '#60a5fa',
            }}
          >
            {data.library === 'p5js' ? 'p5' : '3js'}
          </span>
          <button
            onClick={() => store.deleteNode(id)}
            className="text-text-muted hover:text-error text-xs w-5 h-5 flex items-center justify-center rounded hover:bg-surface3"
            title="Delete node"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Preview or loading state */}
      <div className="relative" style={{ width: PREVIEW_W + 20, height: PREVIEW_H + 10, padding: '5px 10px 5px 10px' }}>
        {data.code ? (
          <SketchPreview
            code={data.code}
            library={data.library}
            isRunning={data.isRunning}
            generationKey={data.generationKey}
            width={PREVIEW_W}
            height={PREVIEW_H}
          />
        ) : (
          <div
            className="flex items-center justify-center text-text-muted text-sm"
            style={{ width: PREVIEW_W, height: PREVIEW_H, background: '#0d0d15', borderRadius: 4 }}
          >
            <span className="animate-pulse">Waiting for generation…</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1 px-3 pb-2">
        <button
          onClick={() => store.updateSketchRunning(id, !data.isRunning)}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-surface3"
          title={data.isRunning ? 'Pause' : 'Play'}
        >
          {data.isRunning ? '⏸' : '▶'}
        </button>
        <button
          onClick={() => store.reloadSketch(id)}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-surface3"
          title="Reload"
        >
          ↺
        </button>
        <button
          onClick={() => store.setActiveCodeNodeId(store.activeCodeNodeId === id ? null : id)}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
          style={{
            color: store.activeCodeNodeId === id ? '#7c3aed' : '#a0a0a0',
            background: store.activeCodeNodeId === id ? 'rgba(124,58,237,0.15)' : 'transparent',
          }}
          title="Toggle code editor"
        >
          {'</>'} {store.activeCodeNodeId === id ? 'Hide Code' : 'Show Code'}
        </button>
        <div className="flex-1" />
        {/* Operation menu trigger */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="px-2 py-1 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-surface3 border border-border-bright"
            title="Operations"
          >
            + Op
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 bottom-full mb-1 z-50 rounded-md overflow-hidden shadow-popup"
              style={{ background: '#1a1a2a', border: '1px solid #333', minWidth: 130 }}
              onMouseLeave={() => setMenuOpen(false)}
            >
              {OP_MENU.map((op) => (
                <button
                  key={op.type}
                  onClick={() => handleOperation(op.type)}
                  className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-surface3"
                  style={{ color: op.color }}
                >
                  <span>{op.icon}</span>
                  <span className="text-text-secondary">{op.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Parameter sliders */}
      <ParameterSliders nodeId={id} params={data.parameters} />

      {/* Merge mode hint */}
      {isMergingTarget && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-lg text-sm font-medium pointer-events-none"
          style={{ background: 'rgba(29,78,216,0.15)', color: '#60a5fa' }}
        >
          {pendingLabel}
        </div>
      )}
    </div>
  )
})

export default SketchNode
