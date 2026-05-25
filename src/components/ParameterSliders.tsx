/**
 * ParameterSliders : rendered inside sketch nodes.
 *
 * Fixes:
 *  • nodrag + nopan classes + stopPropagation on pointerdown so ReactFlow
 *    doesn't steal slider drag events.
 *  • Uses store.patchSketchParameter which updates the code + value WITHOUT
 *    recalculating min/max, so the slider handle tracks the mouse correctly.
 *  • Editable numeric text input alongside the range slider.
 *  • Click on a param label to "pick it up" and transfer to another sketch
 *    (sets draggingParam in the global store).
 */
import { memo, useState } from 'react'
import Icon from './ui/Icon'
import type { Parameter } from '../utils/types'
import { useStore } from '../store/store'

interface Props {
  nodeId: string
  params: Parameter[]
}

const ParameterSliders = memo(function ParameterSliders({ nodeId, params }: Props) {
  const patchParam    = useStore((s) => s.patchSketchParameter)
  const getNode       = useStore((s) => s.getSketchNode)
  const draggingParam = useStore((s) => s.draggingParam)
  const setDragging   = useStore((s) => s.setDraggingParam)

  // Per-param text-edit draft state
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editDraft,   setEditDraft]   = useState('')

  if (params.length === 0) return null

  function applyValue(param: Parameter, raw: number) {
    // Clamp to the stored bounds (which don't change during dragging)
    const clamped = Math.max(param.min, Math.min(param.max, raw))
    if (isNaN(clamped)) return
    patchParam(nodeId, param.name, clamped)
  }

  function handleLabelClick(param: Parameter) {
    const node = getNode(nodeId)
    if (!node) return
    // Toggle: clicking the active param cancels the drag
    if (draggingParam?.param.name === param.name && draggingParam.sourceNodeId === nodeId) {
      setDragging(null)
      return
    }
    setDragging({ sourceNodeId: nodeId, param, sourceCode: node.code })
  }

  function commitTextEdit(param: Parameter) {
    const v = parseFloat(editDraft)
    if (!isNaN(v)) applyValue(param, v)
    setEditingName(null)
  }

  const isPickingUp = (name: string) =>
    draggingParam?.sourceNodeId === nodeId && draggingParam.param.name === name

  return (
    <div
      className="nodrag nopan px-3 pb-2 space-y-1.5 border-t border-border mt-1 pt-2"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {params.map((p) => {
        const pickingUp    = isPickingUp(p.name)
        const displayValue = p.step < 1 ? p.value.toFixed(2) : Math.round(p.value).toString()

        return (
          <div key={p.name} className="flex items-center gap-2">
            {/* Label : click to start param transfer */}
            <button
              className="flex items-center gap-1 text-2xs font-mono truncate transition-colors text-left nodrag"
              style={{
                minWidth:   80,
                maxWidth:   80,
                color:      pickingUp ? '#a78bfa' : '#666',
                background: pickingUp ? 'rgba(140,73,223,0.15)' : 'transparent',
                borderRadius: 3,
                padding:    '1px 3px',
                cursor:     'pointer',
              }}
              title={
                pickingUp
                  ? 'Click another sketch to transfer this parameter'
                  : `${p.semanticLabel || p.label}\n(click to transfer)`
              }
              onClick={() => handleLabelClick(p)}
            >
              {pickingUp && (
                <Icon name="param-transfer" size={10} style={{ flexShrink: 0 }} />
              )}
              <span className="truncate">{p.semanticLabel || p.label}</span>
            </button>

            {/* Range slider : value stays within the fixed bounds */}
            <input
              type="range"
              min={p.min}
              max={p.max}
              step={p.step}
              value={p.value}
              onChange={(e) => applyValue(p, parseFloat(e.target.value))}
              onPointerDown={(e) => e.stopPropagation()}
              className="flex-1 h-1 accent-accent cursor-pointer nodrag nopan"
              style={{ minWidth: 0 }}
            />

            {/* Numeric badge / editable input */}
            {editingName === p.name ? (
              <input
                type="number"
                value={editDraft}
                autoFocus
                onChange={(e) => setEditDraft(e.target.value)}
                onBlur={() => commitTextEdit(p)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter')  commitTextEdit(p)
                  if (e.key === 'Escape') setEditingName(null)
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="text-2xs font-mono text-right rounded outline-none nodrag"
                style={{
                  width:      48,
                  background: '#1a1a2e',
                  border:     '1px solid #8C49DF',
                  color:      '#f0f0f0',
                  padding:    '1px 3px',
                }}
              />
            ) : (
              <button
                className="text-2xs text-text-muted font-mono text-right nodrag hover:text-text-primary transition-colors"
                style={{ width: 48, padding: '1px 3px' }}
                onClick={() => { setEditingName(p.name); setEditDraft(displayValue) }}
                title="Click to type a value"
              >
                {displayValue}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
})

export default ParameterSliders
