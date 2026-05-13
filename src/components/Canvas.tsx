import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type NodeTypes,
  type EdgeTypes,
  ConnectionMode,
  MarkerType,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useStore } from '../store/store'
import SketchNode from './nodes/SketchNode'
import OperatorNode from './nodes/OperatorNode'

const nodeTypes: NodeTypes = {
  sketch:   SketchNode,
  operator: OperatorNode,
}

// Styled edges
const defaultEdgeStyle = {
  stroke: '#4a4a6a',
  strokeWidth: 1.5,
}

export default function Canvas() {
  const nodes          = useStore((s) => s.nodes)
  const edges          = useStore((s) => s.edges)
  const onNodesChange  = useStore((s) => s.onNodesChange)
  const onEdgesChange  = useStore((s) => s.onEdgesChange)
  const mergingId      = useStore((s) => s.mergingSourceId)
  const pendingOpType  = useStore((s) => s.pendingOpType)

  const styledEdges = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        style: defaultEdgeStyle,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#4a4a6a',
        },
        animated: false,
      })),
    [edges]
  )

  return (
    <div className="relative w-full h-full">
      {mergingId && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-sm font-medium pointer-events-none"
          style={{ background: 'rgba(29,78,216,0.9)', color: '#fff', backdropFilter: 'blur(4px)' }}
        >
          {pendingOpType === 'diff' ? '⊟ Click another sketch to compare' : '⊕ Click another sketch to merge'}
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#080808' }}
        deleteKeyCode="Delete"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#1e1e2e"
        />
        <Controls
          style={{
            background: '#111118',
            border: '1px solid #2a2a3a',
            borderRadius: 8,
          }}
        />
        <MiniMap
          style={{ background: '#0e0e16', border: '1px solid #2a2a3a' }}
          nodeColor={(n) => {
            if (n.type === 'sketch')   return '#1a1f2e'
            if (n.type === 'operator') return '#1c1428'
            return '#222'
          }}
          maskColor="rgba(8,8,8,0.7)"
        />
      </ReactFlow>
    </div>
  )
}
