import { useState } from 'react'
import { Panel } from '@xyflow/react'
import type { OperatorType } from '../utils/types'
import { useStore } from '../store/store'
import Icon from './ui/Icon'

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  panel: {
    display: 'flex', flexDirection: 'column', gap: 3, padding: 6,
    background: '#111', border: '1px solid #333', borderRadius: 2,
    boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
  } as React.CSSProperties,
  divider: { height: 1, background: '#2a2a2a', margin: '2px 0' } as React.CSSProperties,
  cancel:  { padding: '3px 0', background: 'transparent', border: 'none', color: '#ef4444', fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer', textAlign: 'center' } as React.CSSProperties,
}

// ── Data ──────────────────────────────────────────────────────────────────────

interface BtnDef { icon: string; label: string; color: string; title: string }

const OPS: (BtnDef & { type: OperatorType })[] = [
  { type: 'modify',    label: 'Modify',  icon: 'modify',    color: '#8C49DF', title: 'Modify a sketch with a prompt' },
  { type: 'merge',     label: 'Merge',   icon: 'merge',     color: '#1d4ed8', title: 'Blend two sketches into one' },
  { type: 'diff',      label: 'Diff',    icon: 'diff',      color: '#047857', title: 'Compare two sketches' },
  { type: 'extract',   label: 'Extract', icon: 'extract',   color: '#b45309', title: 'Isolate a visual element' },
  { type: 'duplicate', label: 'Clone',   icon: 'duplicate', color: '#ca8a04', title: 'Clone a sketch to branch from' },
]
const CLEAR: BtnDef = { icon: 'delete', label: 'Clear', color: '#ef4444', title: 'Clear the canvas' }

// ── Button ────────────────────────────────────────────────────────────────────

function ToolbarBtn({ icon, label, color, active = false, onClick, title }: BtnDef & { active?: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  const lit = active || hov
  return (
    <button onClick={onClick} title={title} className="nodrag"
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', minWidth: 118,
        border: `1px solid ${lit ? color : '#2a2a2a'}`, borderRadius: 3,
        background: lit ? `color-mix(in srgb, ${color} 12%, transparent)` : 'transparent',
        color: lit ? color : '#707070',
        fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500,
        cursor: 'pointer', transition: 'all 0.1s',
      }}
    >
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 22, height: 22, flexShrink: 0, borderRadius: 2,
        border: `2px solid ${lit ? color : '#444'}`, transition: 'border-color 0.1s',
      }}>
        <Icon name={icon} size={10} />
      </span>
      {label}
    </button>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export default function OpsToolbar() {
  const pendingOp   = useStore((s) => s.pendingToolbarOp)
  const setPending  = useStore((s) => s.setPendingToolbarOp)
  const mergingId   = useStore((s) => s.mergingSourceId)
  const resetCanvas = useStore((s) => s.resetCanvas)

  return (
    <Panel position="top-left" style={{ marginTop: 8, marginLeft: 8 }}>
      <div style={S.panel}>
        {OPS.map((op) => (
          <ToolbarBtn key={op.type} {...op}
            active={pendingOp === op.type || (!!mergingId && (op.type === 'merge' || op.type === 'diff'))}
            onClick={() => setPending(pendingOp === op.type ? null : op.type)}
          />
        ))}
        {(pendingOp || mergingId) && (
          <button onClick={() => setPending(null)} className="nodrag" style={S.cancel}>
            × cancel
          </button>
        )}
        <div style={S.divider} />
        <ToolbarBtn {...CLEAR}
          onClick={() => window.confirm('Reset canvas? All nodes and edges will be removed.') && resetCanvas()}
        />
      </div>
    </Panel>
  )
}
