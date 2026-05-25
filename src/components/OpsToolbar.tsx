/**
 * Persistent operations toolbar : rendered inside the ReactFlow canvas via <Panel>.
 * Each op button uses the glitch icon-badge pattern: bordered icon + label.
 */
import { useState } from 'react'
import { Panel } from '@xyflow/react'
import type { OperatorType } from '../utils/types'
import { useStore } from '../store/store'
import Icon from './ui/Icon'

interface OpEntry {
  type:  OperatorType
  label: string
  icon:  string
  color: string
  title: string
}

const OPS: OpEntry[] = [
  { type: 'modify',    label: 'Modify',    icon: 'modify',    color: '#8C49DF', title: 'Modify a sketch with a prompt' },
  { type: 'merge',     label: 'Merge',     icon: 'merge',     color: '#1d4ed8', title: 'Blend two sketches into one' },
  { type: 'diff',      label: 'Diff',      icon: 'diff',      color: '#047857', title: 'Compare two sketches' },
  { type: 'extract',   label: 'Extract',   icon: 'extract',   color: '#b45309', title: 'Isolate a visual element as a new sketch' },
  { type: 'duplicate', label: 'Clone',     icon: 'duplicate', color: '#4b5563', title: 'Clone a sketch to branch from' },
]

function OpButton({ op, isActive, onClick }: { op: OpEntry; isActive: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  const lit = isActive || hovered
  return (
    <button
      onClick={onClick}
      title={op.title}
      className="nodrag"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 10px',
        border: `1px solid ${lit ? op.color : '#2a2a2a'}`,
        borderRadius: 3,
        background: lit ? `color-mix(in srgb, ${op.color} 14%, transparent)` : 'transparent',
        color: lit ? op.color : '#707070',
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
        border: `2px solid ${lit ? op.color : '#444'}`,
        borderRadius: 2,
        flexShrink: 0,
        transition: 'border-color 0.1s',
      }}>
        <Icon name={op.icon} size={10} />
      </span>
      {op.label}
    </button>
  )
}

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
            <OpButton key={op.type} op={op} isActive={isActive} onClick={() => handleClick(op.type)} />
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
            <Icon name="delete" size={10} />
          </span>
          Clear
        </button>
      </div>
    </Panel>
  )
}
