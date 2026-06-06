import { memo, useState, useCallback, useEffect, useRef } from 'react'
import { Handle, Position, NodeResizer, type NodeProps, type Node, useReactFlow } from '@xyflow/react'
import { nanoid } from 'nanoid'
import Icon from '../ui/Icon'
import type { SketchNodeData, OperatorType } from '../../utils/types'
import { useStore } from '../../store/store'
import { buildSketchPopupHtml } from '../../utils/codeUtils'
import { generate } from '../../api/providers'
import { buildRegionalEditMessages, getRegionalEditSystem } from '../../prompts'
import SketchPreview from '../SketchPreview'
import ParameterSliders from '../ParameterSliders'
import SemanticAxes    from '../SemanticAxes'
import { Badge } from '../ui/badge'

type SketchNodeType = Node<SketchNodeData, 'sketch'>

const PREVIEW_W = 260
const PREVIEW_H = 200

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  ctrl: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 26, height: 26, padding: 0, borderRadius: 2, flexShrink: 0,
    border: '2px solid #3a3a3a', background: 'transparent', color: '#606060',
    cursor: 'pointer', transition: 'background 0.1s',
  } as React.CSSProperties,
  ctrlActive: {
    border: '2px solid #8C49DF', color: '#8C49DF', background: 'rgba(140,73,223,0.12)',
  } as React.CSSProperties,
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '5px 8px', borderBottom: '1px solid #222', background: 'rgba(0,0,0,0.25)',
  } as React.CSSProperties,
  controls: {
    display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px 6px',
  } as React.CSSProperties,
  rfHandle:      { width: 10, height: 10, borderRadius: 1, border: 'none' } as React.CSSProperties,
  resizerHandle: { width: 10, height: 10, borderRadius: 2, border: '2px solid white', background: '#111' } as React.CSSProperties,
  titleInput: {
    background: '#1a1a1a', borderRadius: 2, padding: '1px 5px', width: 120,
    color: '#f0f0f0', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-sans)', outline: 'none',
  } as React.CSSProperties,
}

// ── CtrlButton ────────────────────────────────────────────────────────────────

function CtrlButton({ active, extraStyle, children, ...props }: {
  active?: boolean; extraStyle?: React.CSSProperties; children: React.ReactNode
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style'>) {
  const [hov, setHov] = useState(false)
  return (
    <button {...props}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ ...(active ? { ...S.ctrl, ...S.ctrlActive } : S.ctrl), ...(hov ? { background: 'rgba(255,255,255,0.07)' } : {}), ...extraStyle }}>
      {children}
    </button>
  )
}

// ── SketchNode ────────────────────────────────────────────────────────────────

const SketchNode = memo(function SketchNode({ id, data, selected }: NodeProps<SketchNodeType>) {
  const [editingTitle, setEditingTitle] = useState(false)
  const store = useStore()
  const { fitView } = useReactFlow()

  const previewW = (data.width ?? PREVIEW_W + 20) - 20

  // ResizeObserver feeds the exact rendered preview height to SketchPreview,
  // accounting for ParameterSliders and SemanticAxes taking space below.
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const [measuredPreviewH, setMeasuredPreviewH] = useState(PREVIEW_H)
  useEffect(() => {
    const el = previewContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setMeasuredPreviewH(Math.max(60, e.contentRect.height)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleMaximize = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    fitView({ nodes: [{ id }], padding: 0.35, duration: 400 })
  }, [id, fitView])

  const isBackground = store.backgroundSketchId === id
  const handleToggleBackground = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    store.setBackgroundSketchId(isBackground ? null : id)
  }, [id, isBackground, store])

  const popupRef = useRef<Window | null>(null)
  const handleOpenInWindow = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (popupRef.current && !popupRef.current.closed) { popupRef.current.focus(); return }
    const w = window.open('', `melanie-sketch-${id}`, 'width=900,height=700,toolbar=no,menubar=no')
    if (!w) { alert('Popup blocked, please allow popups for this site.'); return }
    popupRef.current = w
    w.document.open()
    w.document.write(buildSketchPopupHtml(data.code, data.library, data.title))
    w.document.close()
  }, [id, data.code, data.library, data.title])

  useEffect(() => {
    const p = popupRef.current
    if (!p || p.closed) return
    p.postMessage({ type: 'code-update', code: data.code, library: data.library }, '*')
  }, [data.code, data.library])

  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      if (!popupRef.current || e.source !== popupRef.current) return
      const d = e.data
      if (!d || typeof d !== 'object' || d.type !== 'regional-edit') return
      const { region, prompt: regionPrompt } = d as { type: 'regional-edit'; region: { x: number; y: number; w: number; h: number; canvasW: number; canvasH: number }; prompt: string }
      const apiKey = store.getActiveKey()
      if (!apiKey) {
        popupRef.current?.postMessage({ type: 'generation-error', message: 'No API key set. Add one via "Connect Models" in the top bar.' }, '*')
        return
      }
      popupRef.current?.postMessage({ type: 'generation-state', generating: true }, '*')
      try {
        const newCode = await generate({ providerId: store.providerId, apiKey, modelId: store.modelId, system: getRegionalEditSystem(data.library), messages: buildRegionalEditMessages(data.code, regionPrompt, region, data.library), maxTokens: 4096 })
        store.updateSketchCode(id, newCode)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        popupRef.current?.postMessage({ type: 'generation-error', message: msg }, '*')
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [id, data.code, data.library, store])

  const handleToolbarOpTarget = useCallback(() => {
    const op = store.pendingToolbarOp
    if (!op) return
    store.setPendingToolbarOp(null)
    const pos   = store.getNodePosition(id)
    const baseX = (pos?.x ?? 0) + PREVIEW_W + 120
    const baseY = (pos?.y ?? 0)

    if (op === 'merge' || op === 'diff') { store.setMergingSourceId(id, op); return }

    if (op === 'duplicate') {
      const newId = store.addSketchNode({ code: data.code, library: data.library, position: { x: baseX + 300, y: baseY }, title: data.title + ' copy' })
      const opId  = store.addOperatorNode({ operatorType: 'duplicate', sourceNodeIds: [id], position: { x: baseX, y: baseY + 70 } })
      store.updateOperator(opId, { targetNodeId: newId })
      store.addEdge({ id: nanoid(6), source: id,   target: opId, sourceHandle: 'right' })
      store.addEdge({ id: nanoid(6), source: opId, target: newId, targetHandle: 'left' })
      return
    }
    const targetId = store.addSketchNode({ code: '', library: data.library, position: { x: baseX + 340, y: baseY }, title: store.nextSketchTitle() })
    const opId     = store.addOperatorNode({ operatorType: op, sourceNodeIds: [id], position: { x: baseX, y: baseY + 60 } })
    store.updateOperator(opId, { targetNodeId: targetId })
    store.addEdge({ id: nanoid(6), source: id,   target: opId,     sourceHandle: 'right' })
    store.addEdge({ id: nanoid(6), source: opId, target: targetId, targetHandle: 'left'  })
  }, [id, data, store])

  const handleMergeTarget = useCallback(() => {
    const mergingId = store.mergingSourceId
    const opType    = store.pendingOpType ?? 'merge'
    if (!mergingId || mergingId === id) { store.setMergingSourceId(null); return }
    store.setMergingSourceId(null)
    const pos1 = store.getNodePosition(mergingId)
    const pos2 = store.getNodePosition(id)
    const opX  = ((pos1?.x ?? 0) + (pos2?.x ?? 0)) / 2 + 140
    const opY  = ((pos1?.y ?? 0) + (pos2?.y ?? 0)) / 2 + 100

    if (opType === 'diff') {
      const opId = store.addOperatorNode({ operatorType: 'diff', sourceNodeIds: [mergingId, id], position: { x: opX, y: opY } })
      store.addEdge({ id: nanoid(6), source: mergingId, target: opId, sourceHandle: 'right' })
      store.addEdge({ id: nanoid(6), source: id,        target: opId, sourceHandle: 'right' })
      return
    }
    const targetId = store.addSketchNode({ code: '', library: data.library, position: { x: Math.max((pos1?.x ?? 0), (pos2?.x ?? 0)) + 400, y: opY - 60 }, title: store.nextSketchTitle() })
    const opId     = store.addOperatorNode({ operatorType: 'merge', sourceNodeIds: [mergingId, id], position: { x: opX, y: opY } })
    store.updateOperator(opId, { targetNodeId: targetId })
    store.addEdge({ id: nanoid(6), source: mergingId, target: opId,     sourceHandle: 'right' })
    store.addEdge({ id: nanoid(6), source: id,        target: opId,     sourceHandle: 'right' })
    store.addEdge({ id: nanoid(6), source: opId,      target: targetId, targetHandle: 'left'  })
  }, [id, data.library, store])

  const handleParamDrop = useCallback(() => {
    const dp = store.draggingParam
    if (!dp || dp.sourceNodeId === id) return
    store.setDraggingParam(null)
    const pos    = store.getNodePosition(id)
    const baseX  = (pos?.x ?? 0) + PREVIEW_W + 120
    const baseY  = (pos?.y ?? 0)
    const targetId = store.addSketchNode({ code: '', library: data.library, position: { x: baseX + 340, y: baseY }, title: store.nextSketchTitle() })
    const opId     = store.addOperatorNode({ operatorType: 'modify', sourceNodeIds: [id], position: { x: baseX, y: baseY + 60 } })
    const transferPrompt =
      `Incorporate the parameter "${dp.param.semanticLabel || dp.param.label}" ` +
      `(variable: ${dp.param.name}, value: ${dp.param.value}) from another sketch. ` +
      `Add a global variable that controls a visually equivalent or complementary effect. ` +
      `Source sketch context:\n${dp.sourceCode.slice(0, 600)}`
    store.updateOperator(opId, { targetNodeId: targetId, prompt: transferPrompt, autoGenerate: true, paramTransferLabel: dp.param.semanticLabel || dp.param.label })
    store.addEdge({ id: nanoid(6), source: id,   target: opId,     sourceHandle: 'right' })
    store.addEdge({ id: nanoid(6), source: opId, target: targetId, targetHandle: 'left'  })
    store.addEdge({ id: nanoid(6), source: dp.sourceNodeId, target: targetId, data: { kind: 'param-transfer' } })
  }, [id, data.library, store])

  const handleNodeClick = useCallback(() => {
    if (store.pendingToolbarOp)                                   { handleToolbarOpTarget(); return }
    if (store.mergingSourceId && store.mergingSourceId !== id)    { handleMergeTarget();     return }
    if (store.draggingParam && store.draggingParam.sourceNodeId !== id) { handleParamDrop(); return }
  }, [store, handleToolbarOpTarget, handleMergeTarget, handleParamDrop, id])

  const isMergingTarget    = !!store.mergingSourceId && store.mergingSourceId !== id
  const isToolbarOpTarget  = !!store.pendingToolbarOp
  const isParamDropTarget  = !!store.draggingParam && store.draggingParam.sourceNodeId !== id
  const isInteractiveTarget = isMergingTarget || isToolbarOpTarget || isParamDropTarget

  let overlayLabel = ''
  if (isMergingTarget)   overlayLabel = store.pendingOpType === 'diff' ? 'Click to compare' : 'Click to merge'
  else if (isToolbarOpTarget) overlayLabel = `Click to ${store.pendingToolbarOp}`
  else if (isParamDropTarget) overlayLabel = `Drop "${store.draggingParam!.param.semanticLabel || store.draggingParam!.param.label}"`

  const nodeAccent = data.library === 'p5js' ? '#8C49DF' : '#3b82f6'
  let borderStyle  = selected ? `1.5px solid ${nodeAccent}` : '1px solid #2a2a2a'
  if (isMergingTarget)   borderStyle = '1.5px dashed #1d4ed8'
  if (isToolbarOpTarget) borderStyle = `1.5px dashed ${nodeAccent}`
  if (isParamDropTarget) borderStyle = '1.5px dashed #a78bfa'

  return (
    <div className="sketch-node"
      style={{
        background: '#111', border: borderStyle, borderRadius: 2,
        boxShadow: selected ? `0 0 0 2px ${nodeAccent}30, 0 4px 24px rgba(0,0,0,0.7)` : '0 4px 24px rgba(0,0,0,0.5)',
        width: data.width ?? (PREVIEW_W + 20), height: '100%',
        display: 'flex', flexDirection: 'column',
        cursor: isInteractiveTarget ? 'crosshair' : 'default',
      }}
      onClick={handleNodeClick}
    >
      <NodeResizer isVisible={selected} minWidth={PREVIEW_W + 20} minHeight={PREVIEW_H + 80}
        color={nodeAccent} handleStyle={S.resizerHandle} lineStyle={{ display: 'none' }}
        onResize={(_, p) => store.updateSketchDims(id, p.width, p.height)}
      />
      <Handle type="target" position={Position.Left}  id="left"  style={{ ...S.rfHandle, background: nodeAccent }} />
      <Handle type="source" position={Position.Right} id="right" style={{ ...S.rfHandle, background: nodeAccent }} />

      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {editingTitle ? (
            <input autoFocus defaultValue={data.title}
              onBlur={(e)    => { store.updateSketchTitle(id, e.target.value); setEditingTitle(false) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { store.updateSketchTitle(id, e.currentTarget.value); setEditingTitle(false) } }}
              style={{ ...S.titleInput, border: `1px solid ${nodeAccent}` }}
              className="nodrag" onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span style={{ fontSize: 11, fontWeight: 600, color: '#d0d0d0', letterSpacing: '-0.01em', cursor: 'pointer' }}
              onDoubleClick={() => setEditingTitle(true)}>
              {data.title}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <Badge variant={data.library === 'p5js' ? 'p5' : 'threejs'} className="rounded-sm">
            {data.library === 'p5js' ? 'p5' : '3js'}
          </Badge>
          <button style={{ ...S.ctrl, width: 20, height: 20, border: '1px solid #2a2a2a' }}
            onClick={(e) => { e.stopPropagation(); store.deleteNode(id) }}
            title="Delete node" className="nodrag">
            <Icon name="delete" size={9} />
          </button>
        </div>
      </div>

      {/* Preview — flex:1 so it fills whatever height the resized node provides */}
      <div ref={previewContainerRef}
        style={{ flex: 1, minHeight: data.height ? 60 : PREVIEW_H + 10, padding: '5px 10px', overflow: 'hidden' }}>
        {data.code ? (
          <SketchPreview code={data.code} library={data.library} isRunning={data.isRunning}
            generationKey={data.generationKey} width={previewW} height={measuredPreviewH} nodeId={id} />
        ) : (
          <div className="flex items-center justify-center text-text-muted text-sm"
            style={{ width: previewW, height: measuredPreviewH, background: '#0a0a0a', borderRadius: 2 }}>
            <span className="animate-pulse">Waiting for generation…</span>
          </div>
        )}
      </div>

      <div style={S.controls} onClick={(e) => e.stopPropagation()}>
        <CtrlButton onClick={() => store.updateSketchRunning(id, !data.isRunning)} title={data.isRunning ? 'Pause' : 'Play'} className="nodrag">
          <Icon name={data.isRunning ? 'pause' : 'play'} size={11} />
        </CtrlButton>
        <CtrlButton onClick={() => store.reloadSketch(id)} title="Reload" className="nodrag">
          <Icon name="restart" size={11} />
        </CtrlButton>
        <CtrlButton active={store.activeCodeNodeId === id}
          onClick={() => store.setActiveCodeNodeId(store.activeCodeNodeId === id ? null : id)}
          title="Toggle code editor" className="nodrag">
          <Icon name="code-editor" size={11} />
        </CtrlButton>
        <CtrlButton active={isBackground} onClick={handleToggleBackground}
          title={isBackground ? 'Stop drawing behind canvas' : 'Draw behind canvas'} className="nodrag">
          <Icon name="display-background" size={11} />
        </CtrlButton>
        <CtrlButton onClick={handleOpenInWindow} title="Open in new window" className="nodrag">
          <Icon name="open-new-tab" size={11} />
        </CtrlButton>
        <CtrlButton onClick={handleMaximize} title="Zoom to fit" className="nodrag" extraStyle={{ marginLeft: 'auto' }}>
          <Icon name="zoom-to-fit" size={11} />
        </CtrlButton>
      </div>

      <ParameterSliders nodeId={id} params={data.parameters} />
      <SemanticAxes nodeId={id} />

      {isInteractiveTarget && (
        <div className="absolute inset-0 flex items-center justify-center text-sm font-medium"
          style={{
            cursor: 'crosshair',
            background: isParamDropTarget ? 'rgba(140,73,223,0.1)' : isMergingTarget ? 'rgba(29,78,216,0.1)' : 'rgba(140,73,223,0.07)',
            color:      isParamDropTarget ? '#a78bfa' : isMergingTarget ? '#60a5fa' : '#c084fc',
          }}
          onClick={(e) => { e.stopPropagation(); handleNodeClick() }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.55)', padding: '6px 14px', borderRadius: 3, backdropFilter: 'blur(4px)' }}>
            {isParamDropTarget && <Icon name="param-transfer" size={14} />}
            {isMergingTarget   && <Icon name={store.pendingOpType === 'diff' ? 'diff' : 'merge'} size={14} />}
            {isToolbarOpTarget && !isMergingTarget && <Icon name={store.pendingToolbarOp ?? 'modify'} size={14} />}
            <span>{overlayLabel}</span>
          </div>
        </div>
      )}
    </div>
  )
})

export default SketchNode
