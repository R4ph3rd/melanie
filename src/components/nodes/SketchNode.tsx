import { memo, useState, useCallback, useEffect, useRef } from 'react'
import { Handle, Position, NodeResizer, type NodeProps, type Node, useReactFlow } from '@xyflow/react'
import { nanoid } from 'nanoid'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlay, faPause, faRotateRight, faCode, faXmark, faExpand,
  faMagicWandSparkles, faClone, faCodeMerge, faCodeBranch, faScissors,
  faArrowRightArrowLeft, faImage, faUpRightFromSquare,
} from '@fortawesome/free-solid-svg-icons'
import type { SketchNodeData, OperatorType } from '../../utils/types'
import { useStore } from '../../store/store'
import { buildSketchPopupHtml } from '../../utils/codeUtils'
import { generate } from '../../api/providers'
import { buildRegionalEditMessages, getRegionalEditSystem } from '../../prompts'
import SketchPreview from '../SketchPreview'
import ParameterSliders from '../ParameterSliders'
import SemanticAxes    from '../SemanticAxes'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'

type SketchNodeType = Node<SketchNodeData, 'sketch'>

const PREVIEW_W = 260
const PREVIEW_H = 200

const SketchNode = memo(function SketchNode({ id, data, selected }: NodeProps<SketchNodeType>) {
  const [editingTitle, setEditingTitle] = useState(false)
  const store = useStore()
  const { fitView } = useReactFlow()

  // ─── Node dimensions (controlled by NodeResizer) ──────────────────────────
  // PREVIEW_W/H are the defaults for new nodes. Once resized, the user-chosen
  // size is persisted on data.width/height.
  const previewW = (data.width  ?? PREVIEW_W + 20) - 20  // node total minus side padding
  const previewH = (data.height ?? PREVIEW_H)

  const handleMaximize = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    fitView({ nodes: [{ id }], padding: 0.35, duration: 400 })
  }, [id, fitView])

  // ─── Background sketch toggle ─────────────────────────────────────────────
  const isBackground = store.backgroundSketchId === id
  const handleToggleBackground = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    store.setBackgroundSketchId(isBackground ? null : id)
  }, [id, isBackground, store])

  // ─── Open sketch in a new browser window ──────────────────────────────────
  // Holds a reference to the popup window so we can push code updates to it
  // and listen for regional-edit requests coming back.
  const popupRef = useRef<Window | null>(null)

  const handleOpenInWindow = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    // Re-focus an existing popup instead of opening a new one
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.focus()
      return
    }
    const w = window.open('', `melanie-sketch-${id}`, 'width=900,height=700,toolbar=no,menubar=no')
    if (!w) {
      alert('Popup blocked, please allow popups for this site.')
      return
    }
    popupRef.current = w
    // document.write keeps the popup at the opener's origin so postMessage
    // works without CORS friction (Blob URLs have origin "null").
    w.document.open()
    w.document.write(buildSketchPopupHtml(data.code, data.library, data.title))
    w.document.close()
  }, [id, data.code, data.library, data.title])

  // Push code updates to the popup whenever data.code (or library) changes.
  useEffect(() => {
    const p = popupRef.current
    if (!p || p.closed) return
    p.postMessage({ type: 'code-update', code: data.code, library: data.library }, '*')
  }, [data.code, data.library])

  // Handle messages coming back from the popup, primarily the regional-edit
  // request. We call the LLM here (the popup has no API key access) and push
  // the result back via the code-update message above.
  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      // Accept only messages from our popup
      if (!popupRef.current || e.source !== popupRef.current) return
      const d = e.data
      if (!d || typeof d !== 'object' || d.type !== 'regional-edit') return

      const { region, prompt: regionPrompt } = d as {
        type: 'regional-edit'
        region: { x: number; y: number; w: number; h: number; canvasW: number; canvasH: number }
        prompt: string
      }
      const apiKey = store.getActiveKey()
      if (!apiKey) {
        popupRef.current?.postMessage({ type: 'generation-error', message: 'No API key set. Add one via "Connect Models" in the top bar.' }, '*')
        return
      }
      popupRef.current?.postMessage({ type: 'generation-state', generating: true }, '*')
      try {
        const newCode = await generate({
          providerId: store.providerId,
          apiKey,
          modelId:    store.modelId,
          system:     getRegionalEditSystem(data.library),
          messages:   buildRegionalEditMessages(data.code, regionPrompt, region, data.library),
          maxTokens:  4096,
        })
        store.updateSketchCode(id, newCode)
        // updateSketchCode mutation will trigger the data.code useEffect above
        // which will postMessage the new code to the popup.
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        popupRef.current?.postMessage({ type: 'generation-error', message: msg }, '*')
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [id, data.code, data.library, store])

  // ─── Toolbar-op click handler ──────────────────────────────────────────────
  // When a toolbar op is pending, clicking this sketch applies it.
  const handleToolbarOpTarget = useCallback(() => {
    const op = store.pendingToolbarOp
    if (!op) return
    store.setPendingToolbarOp(null)

    const pos   = store.getNodePosition(id)
    const baseX = (pos?.x ?? 0) + PREVIEW_W + 120
    const baseY = (pos?.y ?? 0)

    if (op === 'merge' || op === 'diff') {
      // Set this node as merge source, user then clicks target
      store.setMergingSourceId(id, op)
      return
    }

    if (op === 'duplicate') {
      const newId = store.addSketchNode({
        code: data.code, library: data.library,
        position: { x: baseX + 300, y: baseY },
        title: data.title + ' copy',
      })
      const opId = store.addOperatorNode({
        operatorType: 'duplicate', sourceNodeIds: [id],
        position: { x: baseX, y: baseY + 70 },
      })
      store.updateOperator(opId, { targetNodeId: newId })
      store.addEdge({ id: nanoid(6), source: id,   target: opId, sourceHandle: 'right' })
      store.addEdge({ id: nanoid(6), source: opId, target: newId, targetHandle: 'left' })
      return
    }

    // modify / extract
    const targetId = store.addSketchNode({
      code: '', library: data.library,
      position: { x: baseX + 340, y: baseY },
      title: store.nextSketchTitle(),
    })
    const opId = store.addOperatorNode({
      operatorType: op, sourceNodeIds: [id],
      position: { x: baseX, y: baseY + 60 },
    })
    store.updateOperator(opId, { targetNodeId: targetId })
    store.addEdge({ id: nanoid(6), source: id,   target: opId,     sourceHandle: 'right' })
    store.addEdge({ id: nanoid(6), source: opId, target: targetId, targetHandle: 'left'  })
  }, [id, data, store])

  // ─── Merge target (existing two-step flow) ─────────────────────────────────
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
    const opX  = ((pos1?.x ?? 0) + (pos2?.x ?? 0)) / 2 + 140
    const opY  = ((pos1?.y ?? 0) + (pos2?.y ?? 0)) / 2 + 100

    if (opType === 'diff') {
      const opId = store.addOperatorNode({
        operatorType: 'diff', sourceNodeIds: [mergingId, id],
        position: { x: opX, y: opY },
      })
      store.addEdge({ id: nanoid(6), source: mergingId, target: opId, sourceHandle: 'right' })
      store.addEdge({ id: nanoid(6), source: id,        target: opId, sourceHandle: 'right' })
      return
    }

    const targetX  = Math.max((pos1?.x ?? 0), (pos2?.x ?? 0)) + 400
    const targetY  = opY - 60
    const targetId = store.addSketchNode({
      code: '', library: data.library,
      position: { x: targetX, y: targetY },
      title: store.nextSketchTitle(),
    })
    const opId = store.addOperatorNode({
      operatorType: 'merge', sourceNodeIds: [mergingId, id],
      position: { x: opX, y: opY },
    })
    store.updateOperator(opId, { targetNodeId: targetId })
    store.addEdge({ id: nanoid(6), source: mergingId, target: opId,     sourceHandle: 'right' })
    store.addEdge({ id: nanoid(6), source: id,        target: opId,     sourceHandle: 'right' })
    store.addEdge({ id: nanoid(6), source: opId,      target: targetId, targetHandle: 'left'  })
  }, [id, data.library, store])

  // ─── Param-transfer drop handler ──────────────────────────────────────────
  const handleParamDrop = useCallback(() => {
    const dp = store.draggingParam
    if (!dp || dp.sourceNodeId === id) return
    store.setDraggingParam(null)

    const pos   = store.getNodePosition(id)
    const baseX = (pos?.x ?? 0) + PREVIEW_W + 120
    const baseY = (pos?.y ?? 0)

    // Create output sketch C
    const targetId = store.addSketchNode({
      code: '', library: data.library,
      position: { x: baseX + 340, y: baseY },
      title: store.nextSketchTitle(),
    })
    // Create operator node (modify type, auto-generates)
    const opId = store.addOperatorNode({
      operatorType: 'modify', sourceNodeIds: [id],
      position: { x: baseX, y: baseY + 60 },
    })
    const transferPrompt =
      `Incorporate the parameter "${dp.param.semanticLabel || dp.param.label}" ` +
      `(variable: ${dp.param.name}, value: ${dp.param.value}) from another sketch. ` +
      `Add a global variable that controls a visually equivalent or complementary effect. ` +
      `Source sketch context:\n${dp.sourceCode.slice(0, 600)}`

    store.updateOperator(opId, {
      targetNodeId: targetId,
      prompt: transferPrompt,
      autoGenerate: true,
      paramTransferLabel: dp.param.semanticLabel || dp.param.label,
    })
    // B → operator → C  (normal edges)
    store.addEdge({ id: nanoid(6), source: id,   target: opId,     sourceHandle: 'right' })
    store.addEdge({ id: nanoid(6), source: opId, target: targetId, targetHandle: 'left'  })
    // A → C  (param-transfer background edge)
    store.addEdge({
      id: nanoid(6), source: dp.sourceNodeId, target: targetId,
      data: { kind: 'param-transfer' },
    })
  }, [id, data.library, store])

  // ─── Click dispatch ────────────────────────────────────────────────────────
  const handleNodeClick = useCallback(() => {
    if (store.pendingToolbarOp) { handleToolbarOpTarget(); return }
    if (store.mergingSourceId && store.mergingSourceId !== id) { handleMergeTarget(); return }
    if (store.draggingParam && store.draggingParam.sourceNodeId !== id) { handleParamDrop(); return }
  }, [store, handleToolbarOpTarget, handleMergeTarget, handleParamDrop, id])

  // ─── Visual state flags ────────────────────────────────────────────────────
  const isMergingTarget    = !!store.mergingSourceId && store.mergingSourceId !== id
  const isToolbarOpTarget  = !!store.pendingToolbarOp
  const isParamDropTarget  = !!store.draggingParam && store.draggingParam.sourceNodeId !== id
  const isInteractiveTarget = isMergingTarget || isToolbarOpTarget || isParamDropTarget

  let overlayLabel = ''
  if (isMergingTarget)
    overlayLabel = store.pendingOpType === 'diff' ? 'Click to compare' : 'Click to merge'
  else if (isToolbarOpTarget)
    overlayLabel = `Click to ${store.pendingToolbarOp}`
  else if (isParamDropTarget)
    overlayLabel = `Drop "${store.draggingParam!.param.semanticLabel || store.draggingParam!.param.label}"`

  let borderStyle = selected ? '1.5px solid #7c3aed' : '1px solid #2a2a3a'
  if (isMergingTarget)   borderStyle = '1.5px dashed #1d4ed8'
  if (isToolbarOpTarget) borderStyle = '1.5px dashed #7c3aed'
  if (isParamDropTarget) borderStyle = '1.5px dashed #a78bfa'

  return (
    <div
      className="sketch-node"
      style={{
        background: '#131825',
        border: borderStyle,
        borderRadius: 8,
        boxShadow: selected
          ? '0 0 0 3px rgba(124,58,237,0.2), 0 4px 24px rgba(0,0,0,0.6)'
          : '0 4px 24px rgba(0,0,0,0.5)',
        minWidth: PREVIEW_W + 20,
        width:    data.width,   // controlled by NodeResizer when set
        cursor:   isInteractiveTarget ? 'crosshair' : 'default',
      }}
      onClick={handleNodeClick}
    >
      {/* Resize handles, visible on selection */}
      <NodeResizer
        isVisible={selected}
        minWidth={PREVIEW_W + 20}
        minHeight={PREVIEW_H + 80}
        color="#7c3aed"
        handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
        lineStyle={{ borderColor: 'rgba(124,58,237,0.4)' }}
        onResize={(_, p) => {
          // Live update so the preview tracks the cursor; the
          // store re-render is cheap and only updates one node.
          store.updateSketchDims(id, p.width, p.height - 80)
        }}
      />

      {/* Handles */}
      <Handle type="target" position={Position.Left}  id="left"  style={{ background: '#7c3aed', width: 10, height: 10 }} />
      <Handle type="source" position={Position.Right} id="right" style={{ background: '#7c3aed', width: 10, height: 10 }} />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        {editingTitle ? (
          <input
            autoFocus
            defaultValue={data.title}
            onBlur={(e)    => { store.updateSketchTitle(id, e.target.value); setEditingTitle(false) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { store.updateSketchTitle(id, e.currentTarget.value); setEditingTitle(false) }
            }}
            className="bg-surface3 text-text-primary text-sm font-medium rounded px-1 w-32 outline-none border border-accent nodrag"
            onClick={(e) => e.stopPropagation()}
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
          <Badge variant={data.library === 'p5js' ? 'p5' : 'threejs'} className="rounded">
            {data.library === 'p5js' ? 'p5' : '3js'}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); store.deleteNode(id) }}
            className="h-5 w-5 text-muted-foreground hover:text-error"
            title="Delete node"
          >
            <FontAwesomeIcon icon={faXmark} />
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="relative" style={{ width: previewW + 20, height: previewH + 10, padding: '5px 10px' }}>
        {data.code ? (
          <SketchPreview
            code={data.code}
            library={data.library}
            isRunning={data.isRunning}
            generationKey={data.generationKey}
            width={previewW}
            height={previewH}
          />
        ) : (
          <div
            className="flex items-center justify-center text-text-muted text-sm"
            style={{ width: previewW, height: previewH, background: '#0d0d15', borderRadius: 4 }}
          >
            <span className="animate-pulse">Waiting for generation…</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1 px-3 pb-2" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => store.updateSketchRunning(id, !data.isRunning)}
          className="text-text-secondary hover:text-text-primary px-2"
          title={data.isRunning ? 'Pause' : 'Play'}
        >
          <FontAwesomeIcon icon={data.isRunning ? faPause : faPlay} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => store.reloadSketch(id)}
          className="text-text-secondary hover:text-text-primary px-2"
          title="Reload"
        >
          <FontAwesomeIcon icon={faRotateRight} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => store.setActiveCodeNodeId(store.activeCodeNodeId === id ? null : id)}
          className="px-2 flex items-center gap-1.5"
          style={{
            color:      store.activeCodeNodeId === id ? '#7c3aed' : '#a0a0a0',
            background: store.activeCodeNodeId === id ? 'rgba(124,58,237,0.15)' : 'transparent',
          }}
          title="Toggle code editor"
        >
          <FontAwesomeIcon icon={faCode} />
          {store.activeCodeNodeId === id ? 'Hide Code' : 'Code'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleBackground}
          className="px-2"
          style={{
            color:      isBackground ? '#7c3aed' : '#a0a0a0',
            background: isBackground ? 'rgba(124,58,237,0.15)' : 'transparent',
          }}
          title={isBackground ? 'Stop drawing this sketch behind the canvas' : 'Draw this sketch behind the canvas'}
        >
          <FontAwesomeIcon icon={faImage} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleOpenInWindow}
          className="text-text-secondary hover:text-text-primary px-2"
          title="Open sketch in new window"
        >
          <FontAwesomeIcon icon={faUpRightFromSquare} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleMaximize}
          className="ml-auto text-text-secondary hover:text-text-primary px-2"
          title="Zoom to fit this node"
        >
          <FontAwesomeIcon icon={faExpand} />
        </Button>
      </div>

      {/* Parameter sliders */}
      <ParameterSliders nodeId={id} params={data.parameters} />

      {/* LLM-proposed latent knobs (chaos/order, dense/sparse, …).
          Each scrub re-prompts the model from the axesBaseline snapshot. */}
      <SemanticAxes nodeId={id} />

      {/* Interactive target overlay — pointer-events-auto so clicks anywhere on
          the node are captured when an operation mode is active, even if child
          elements would otherwise stop propagation. */}
      {isInteractiveTarget && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-lg text-sm font-medium"
          style={{ cursor: 'crosshair',
            background: isParamDropTarget
              ? 'rgba(124,58,237,0.12)'
              : isMergingTarget
              ? 'rgba(29,78,216,0.12)'
              : 'rgba(124,58,237,0.08)',
            color: isParamDropTarget ? '#a78bfa' : isMergingTarget ? '#60a5fa' : '#c084fc',
          }}
          onClick={(e) => { e.stopPropagation(); handleNodeClick() }}
        >
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm">
            {isParamDropTarget && <FontAwesomeIcon icon={faArrowRightArrowLeft} />}
            {isMergingTarget && (store.pendingOpType === 'diff'
              ? <FontAwesomeIcon icon={faCodeBranch} />
              : <FontAwesomeIcon icon={faCodeMerge} />)}
            {isToolbarOpTarget && !isMergingTarget && (() => {
              const icons: Record<string, typeof faMagicWandSparkles> = {
                modify:    faMagicWandSparkles,
                duplicate: faClone,
                merge:     faCodeMerge,
                diff:      faCodeBranch,
                extract:   faScissors,
              }
              const OpIcon = icons[store.pendingToolbarOp!] ?? faMagicWandSparkles
              return <FontAwesomeIcon icon={OpIcon} />
            })()}
            <span>{overlayLabel}</span>
          </div>
        </div>
      )}
    </div>
  )
})

export default SketchNode
