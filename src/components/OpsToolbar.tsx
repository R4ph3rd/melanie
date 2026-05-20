/**
 * Persistent operations toolbar : rendered inside the ReactFlow canvas via <Panel>.
 * Positioned top-left, aligned visually with the zoom Controls.
 * Clicking an op button enters "pending toolbar op" mode; the user then clicks
 * a sketch node to apply the operation.
 */
import { Panel } from '@xyflow/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faMagicWandSparkles,
  faClone,
  faCodeMerge,
  faCodeBranch,
  faScissors,
  faPlus,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type { OperatorType } from '../utils/types'
import { useStore } from '../store/store'

interface OpEntry {
  type: OperatorType
  label: string
  icon: IconDefinition
  color: string
  title: string
}

const OPS: OpEntry[] = [
  { type: 'modify',    label: 'Modify',    icon: faMagicWandSparkles, color: '#7c3aed', title: 'Modify a sketch with a prompt' },
  { type: 'duplicate', label: 'Duplicate', icon: faClone,             color: '#4b5563', title: 'Clone a sketch to branch from' },
  { type: 'merge',     label: 'Merge',     icon: faCodeMerge,         color: '#1d4ed8', title: 'Blend two sketches into one' },
  { type: 'diff',      label: 'Diff',      icon: faCodeBranch,        color: '#047857', title: 'Compare two sketches' },
  { type: 'extract',   label: 'Extract',   icon: faScissors,          color: '#b45309', title: 'Isolate a visual element as a new sketch' },
]

export default function OpsToolbar() {
  const pendingToolbarOp    = useStore((s) => s.pendingToolbarOp)
  const setPendingToolbarOp = useStore((s) => s.setPendingToolbarOp)
  const mergingSourceId     = useStore((s) => s.mergingSourceId)
//   const addSketchNode       = useStore((s) => s.addSketchNode)
  const resetCanvas         = useStore((s) => s.resetCanvas)

  function handleClick(op: OperatorType) {
    // Toggle off if already active
    if (pendingToolbarOp === op) {
      setPendingToolbarOp(null)
      return
    }
    setPendingToolbarOp(op)
  }

  return (
    <Panel position="top-left" style={{ marginTop: 8, marginLeft: 8 }}>
      <div
        className="flex flex-col gap-1 p-1.5 rounded-lg"
        style={{ background: '#111118', border: '1px solid #2a2a3a', boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}
      >
        {OPS.map((op) => {
          const isActive = pendingToolbarOp === op.type ||
            (mergingSourceId && (op.type === 'merge' || op.type === 'diff'))

          return (
            <button
              key={op.type}
              onClick={() => handleClick(op.type)}
              title={op.title}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-all nodrag"
              style={{
                color: isActive ? '#fff' : op.color,
                background: isActive ? op.color : 'transparent',
                border: `1px solid ${isActive ? op.color : 'transparent'}`,
                minWidth: 110,
              }}
            >
              <FontAwesomeIcon icon={op.icon} className="w-3 h-3 flex-shrink-0" />
              <span className="text-text-secondary" style={{ color: isActive ? '#fff' : '#888' }}>
                {op.label}
              </span>
            </button>
          )
        })}

        {/* Cancel hint when a toolbar op is pending */}
        {(pendingToolbarOp || mergingSourceId) && (
          <button
            onClick={() => { setPendingToolbarOp(null) }}
            className="mt-1 text-2xs text-text-muted hover:text-error text-center nodrag"
          >
            × cancel
          </button>
        )}

        {/* ── Canvas actions ── */}
        <div className="mt-1 pt-1" style={{ borderTop: '1px solid #2a2a3a' }}>
          {/* <button
            onClick={() => addSketchNode({ library: 'p5js', position: { x: 300 + Math.random() * 200, y: 200 + Math.random() * 200 } })}
            title="Add a blank sketch to the canvas"
            className="flex items-center gap-2 px-2.5 py-1.5 rounded text-xs w-full nodrag transition-colors hover:bg-surface3"
            style={{ color: '#4ade80', minWidth: 110 }}
          >
            <FontAwesomeIcon icon={faPlus} className="w-3 h-3 flex-shrink-0" />
            <span style={{ color: '#888' }}>New Sketch</span>
          </button> */}
          <button
            onClick={() => {
              if (window.confirm('Reset canvas? All nodes and edges will be removed.'))
                resetCanvas()
            }}
            title="Clear the canvas and start fresh"
            className="flex items-center gap-2 px-2.5 py-1.5 rounded text-xs w-full nodrag transition-colors hover:bg-surface3"
            style={{ color: '#f87171', minWidth: 110 }}
          >
            <FontAwesomeIcon icon={faTrashCan} className="w-3 h-3 flex-shrink-0" />
            <span style={{ color: '#888' }}>Reset Canvas</span>
          </button>
        </div>
      </div>
    </Panel>
  )
}
