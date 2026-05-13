import { memo } from 'react'
import type { Parameter } from '../utils/types'
import { useStore } from '../store/store'
import { updateParameterInCode } from '../utils/codeUtils'
import { extractParameters } from '../utils/codeUtils'

interface Props {
  nodeId: string
  params: Parameter[]
}

const ParameterSliders = memo(function ParameterSliders({ nodeId, params }: Props) {
  const updateCode = useStore((s) => s.updateSketchCode)
  const getNode    = useStore((s) => s.getSketchNode)

  if (params.length === 0) return null

  function handleChange(name: string, value: number) {
    const node = getNode(nodeId)
    if (!node) return
    const newCode = updateParameterInCode(node.code, name, value)
    // Re-extract params to keep values in sync
    const newParams = extractParameters(newCode).map((p) =>
      p.name === name ? { ...p, value } : p
    )
    // Update code in store (this will re-extract params automatically)
    updateCode(nodeId, newCode)
  }

  return (
    <div className="px-3 pb-2 space-y-1.5 border-t border-border mt-1 pt-2">
      {params.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="text-2xs text-text-muted font-mono truncate"
            style={{ minWidth: '80px', maxWidth: '80px' }}
            title={p.label}
          >
            {p.label}
          </span>
          <input
            type="range"
            min={p.min}
            max={p.max}
            step={p.step}
            value={p.value}
            onChange={(e) => handleChange(p.name, parseFloat(e.target.value))}
            className="flex-1 h-1 accent-accent cursor-pointer"
            style={{ minWidth: 0 }}
          />
          <span className="text-2xs text-text-muted font-mono w-8 text-right">
            {p.step < 1 ? p.value.toFixed(2) : Math.round(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
})

export default ParameterSliders
