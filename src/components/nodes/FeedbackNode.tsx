import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { FeedbackNodeData } from '../../utils/types'
import { useStore } from '../../store/store'
import Icon from '../ui/Icon'

type FeedbackNodeType = Node<FeedbackNodeData, 'feedback'>

const COLOR = '#f97316'

const S = {
  root: (selected: boolean): React.CSSProperties => ({
    background: '#111', borderRadius: 2, width: 150,
    border: selected ? `1.5px solid ${COLOR}` : '1px solid #2a2a2a',
    boxShadow: selected ? `0 0 0 2px ${COLOR}25, 0 4px 20px rgba(0,0,0,0.6)` : '0 4px 20px rgba(0,0,0,0.5)',
  }),
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', borderBottom: '1px solid #222', background: 'rgba(0,0,0,0.3)' } as React.CSSProperties,
  handle: { width: 10, height: 10, borderRadius: 1, border: 'none', background: COLOR } as React.CSSProperties,
  deleteBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, padding: 0, borderRadius: 2, border: '1px solid #2a2a2a', background: 'transparent', color: '#555', cursor: 'pointer', flexShrink: 0 } as React.CSSProperties,
}

const FeedbackNode = memo(function FeedbackNode({ id, data, selected }: NodeProps<FeedbackNodeType>) {
  const deleteNode = useStore((s) => s.deleteNode)
  const wired = useStore((s) => {
    const hasIn  = s.edges.some((e) => e.target === id)
    const hasOut = s.edges.some((e) => e.source === id)
    return hasIn && hasOut
  })

  return (
    <div style={S.root(!!selected)}>
      <Handle type="target" position={Position.Left}  id="in"  style={S.handle} />
      <Handle type="source" position={Position.Right} id="out" style={S.handle} />

      <div style={S.header}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: COLOR }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, flexShrink: 0, border: `2px solid ${COLOR}`, borderRadius: 2 }}>
            <Icon name="feedback" size={11} />
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Feedback</span>
        </span>
        <button style={S.deleteBtn} onClick={() => deleteNode(id)} title="Delete">
          <Icon name="delete" size={9} />
        </button>
      </div>

      <div style={{ padding: '8px 10px' }}>
        <p style={{ fontSize: 10, color: '#666', margin: 0, lineHeight: 1.6 }}>
          Feeds the source sketch's canvas to the target as{' '}
          <code style={{ color: COLOR }}>feedbackFrame</code> (an ImageBitmap).
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: wired ? '#4ade80' : '#555' }} />
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: wired ? '#4ade80' : '#555' }}>
            {wired ? 'streaming' : 'connect in → out'}
          </span>
        </div>
      </div>
    </div>
  )
})

export default FeedbackNode
