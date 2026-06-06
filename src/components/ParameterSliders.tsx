import { memo, useState, useCallback } from 'react'
import Icon from './ui/Icon'
import type { Parameter, SourceNodeData } from '../utils/types'
import { useStore } from '../store/store'

interface Props { nodeId: string; params: Parameter[] }

const S = {
  signalTag: { fontSize: 9, fontFamily: 'var(--font-mono)', color: '#0ea5e9', background: 'rgba(14,165,233,0.12)', padding: '1px 4px', borderRadius: 2, maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  unbindBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: 2, background: 'transparent', border: 'none', color: '#0ea5e9', cursor: 'pointer', fontSize: 12, padding: 0, flexShrink: 0 } as React.CSSProperties,
}

const ParameterSliders = memo(function ParameterSliders({ nodeId, params }: Props) {
  const patchParam      = useStore((s) => s.patchSketchParameter)
  const getNode         = useStore((s) => s.getSketchNode)
  const draggingParam   = useStore((s) => s.draggingParam)
  const setDragging     = useStore((s) => s.setDraggingParam)
  const signalBindings  = useStore((s) => s.signalBindings)
  const removeBinding   = useStore((s) => s.removeSignalBinding)
  const nodes           = useStore((s) => s.nodes)

  const [editingName, setEditingName] = useState<string | null>(null)
  const [editDraft,   setEditDraft]   = useState('')

  if (params.length === 0) return null

  function applyValue(param: Parameter, raw: number) {
    const clamped = Math.max(param.min, Math.min(param.max, raw))
    if (isNaN(clamped)) return
    patchParam(nodeId, param.name, clamped)
  }

  function handleLabelClick(param: Parameter) {
    const node = getNode(nodeId)
    if (!node) return
    if (draggingParam?.param.name === param.name && draggingParam.sourceNodeId === nodeId) {
      setDragging(null); return
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

  const bindingFor = useCallback(
    (paramName: string) => signalBindings.find((b) => b.targetNodeId === nodeId && b.paramName === paramName),
    [signalBindings, nodeId],
  )

  function sourceLabel(sourceNodeId: string, channel: string) {
    const n = nodes.find((n) => n.id === sourceNodeId)
    if (!n) return channel
    const type = n.type === 'source' ? (n.data as SourceNodeData).sourceType : n.type
    return `${type}:${channel}`
  }

  function disconnectBinding(bindingId: string) {
    removeBinding(bindingId)
    // Remove the corresponding signal edge from the graph
    const edgeId = `sig-${bindingId}`
    useStore.getState().onEdgesChange([{ type: 'remove', id: edgeId }])
  }

  return (
    <div className="nodrag nopan px-3 pb-2 space-y-1.5 border-t border-border mt-1 pt-2"
      onPointerDown={(e) => e.stopPropagation()}>
      {params.map((p) => {
        const pickingUp    = isPickingUp(p.name)
        const displayValue = p.step < 1 ? p.value.toFixed(2) : Math.round(p.value).toString()
        const binding      = bindingFor(p.name)
        return (
          <div key={p.name} className="flex items-center gap-2">
            <button
              className="flex items-center gap-1 text-2xs font-mono truncate transition-colors text-left nodrag"
              style={{ minWidth: 80, maxWidth: 80, color: pickingUp ? '#a78bfa' : '#666', background: pickingUp ? 'rgba(140,73,223,0.15)' : 'transparent', borderRadius: 3, padding: '1px 3px', cursor: 'pointer' }}
              title={pickingUp ? 'Click another sketch to transfer this parameter' : `${p.semanticLabel || p.label}\n(click to transfer)`}
              onClick={() => handleLabelClick(p)}
            >
              {pickingUp && <Icon name="param-transfer" size={10} style={{ flexShrink: 0 }} />}
              <span className="truncate">{p.semanticLabel || p.label}</span>
            </button>

            <input type="range" min={p.min} max={p.max} step={p.step} value={p.value}
              onChange={(e) => applyValue(p, parseFloat(e.target.value))}
              onPointerDown={(e) => e.stopPropagation()}
              className="flex-1 h-1 cursor-pointer nodrag nopan"
              style={{ minWidth: 0, accentColor: binding ? '#0ea5e9' : undefined }}
            />

            {editingName === p.name ? (
              <input type="number" value={editDraft} autoFocus
                onChange={(e) => setEditDraft(e.target.value)}
                onBlur={() => commitTextEdit(p)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitTextEdit(p); if (e.key === 'Escape') setEditingName(null) }}
                onPointerDown={(e) => e.stopPropagation()}
                className="text-2xs font-mono text-right rounded outline-none nodrag"
                style={{ width: 48, background: '#1a1a2e', border: '1px solid #8C49DF', color: '#f0f0f0', padding: '1px 3px' }}
              />
            ) : binding ? (
              <div className="flex items-center gap-0.5" title={`Signal bound: ${sourceLabel(binding.sourceNodeId, binding.channel)}\nClick × to disconnect`}>
                <span style={S.signalTag}>{sourceLabel(binding.sourceNodeId, binding.channel)}</span>
                <button style={S.unbindBtn} onClick={() => disconnectBinding(binding.id)}>×</button>
              </div>
            ) : (
              <button
                className="text-2xs font-mono text-right nodrag"
                style={{ width: 48, padding: '1px 4px', background: '#1a1a1a', borderRadius: 2, color: '#888', cursor: 'pointer' }}
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
