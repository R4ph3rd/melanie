/**
 * Persistent operations toolbar : rendered inside the ReactFlow canvas via <Panel>.
 * Each op button uses the glitch icon-badge pattern: bordered icon + label.
 */
import { Panel } from '@xyflow/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faMagicWandSparkles,
  faClone,
  faCodeMerge,
  faCodeBranch,
  faScissors,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type { OperatorType } from '../utils/types'
import { useStore } from '../store/store'

interface OpEntry {
  type:  OperatorType
  label: string
  icon:  IconDefinition
  color: string
  title: string
}

const OPS: OpEntry[] = [
  { type: 'modify',    label: 'Modify',    icon: faMagicWandSparkles, color: '#8C49DF', title: 'Modify a sketch with a prompt' },
  { type: 'merge',     label: 'Merge',     icon: faCodeMerge,         color: '#1d4ed8', title: 'Blend two sketches into one' },
  { type: 'diff',      label: 'Diff',      icon: faCodeBranch,        color: '#047857', title: 'Compare two sketches' },
  { type: 'extract',   label: 'Extract',   icon: faScissors,          color: '#b45309', title: 'Isolate a visual element as a new sketch' },
  { type: 'duplicate', label: 'Clone',     icon: faClone,             color: '#4b5563', title: 'Clone a sketch to branch from' },
]

export default function OpsToolbar() {
  const pendingToolbarOp    = useStore((s) => s.pendingToolbarOp)
  const setPendingToolbarOp = useStore((s) => s.setPendingToolbarOp)
  const mergingSourceId     = useStore((s) => s.mergingSourceId)
  const resetCanvas         = useStore((s) => s.resetCanvas)

  function handleClick(op: OperatorType) {
    setPendingToolbarOp(pendingToolbarOp === op ? null : op)
  }

  return (
    <Panel position="top-left" style={{ marginTop: 8, marginLeft: 8 }}>
      <div
        style={{
          display: 'flex', flexDirection: 'column', gap: 3,
          padding: 6,
          background: '#111',
          border: '1px solid #333',
          borderRadius: 4,
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
        }}
      >
        {OPS.map((op) => {
          const isActive = pendingToolbarOp === op.type ||
            (!!mergingSourceId && (op.type === 'merge' || op.type === 'diff'))

          return (
            <button
              key={op.type}
              onClick={() => handleClick(op.type)}
              title={op.title}
              className="nodrag"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 10px',
                border: `1px solid ${isActive ? op.color : '#2a2a2a'}`,
                borderRadius: 3,
                background: isActive ? `color-mix(in srgb, ${op.color} 14%, transparent)` : 'transparent',
                color: isActive ? op.color : '#707070',
                fontFamily: 'var(--font-sans)',
                fontSize: 12, fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.1s',
                minWidth: 118,
              }}
            >
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 22, height: 22,
                border: `2px solid ${isActive ? op.color : '#444'}`,
                borderRadius: 2,
                flexShrink: 0,
                transition: 'border-color 0.1s',
              }}>
                <FontAwesomeIcon icon={op.icon} style={{ width: 10, height: 10 }} />
              </span>
              {op.label}
            </button>
          )
        })}

        {(pendingToolbarOp || mergingSourceId) && (
          <button
            onClick={() => setPendingToolbarOp(null)}
            className="nodrag"
            style={{
              padding: '3px 0',
              background: 'transparent', border: 'none',
              color: '#ef4444', fontSize: 11,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer', textAlign: 'center',
            }}
          >
            × cancel
          </button>
        )}

        <div style={{ height: 1, background: '#2a2a2a', margin: '2px 0' }} />

        <button
          onClick={() => {
            if (window.confirm('Reset canvas? All nodes and edges will be removed.'))
              resetCanvas()
          }}
          title="Clear the canvas and start fresh"
          className="nodrag"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 10px',
            border: '1px solid #2a2a2a',
            borderRadius: 3,
            background: 'transparent',
            color: '#707070',
            fontFamily: 'var(--font-sans)',
            fontSize: 12, fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.1s',
            minWidth: 118,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#f87171'
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#707070'
            e.currentTarget.style.borderColor = '#2a2a2a'
          }}
        >
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22,
            border: '2px solid #3a3a3a',
            borderRadius: 2, flexShrink: 0,
          }}>
            <FontAwesomeIcon icon={faTrashCan} style={{ width: 10, height: 10 }} />
          </span>
          Reset
        </button>
      </div>
    </Panel>
  )
}
