import type { Node, Edge } from '@xyflow/react'

export type LibraryType = 'p5js' | 'threejs'
export type OperatorType = 'modify' | 'duplicate' | 'merge' | 'diff' | 'extract'

export interface Parameter {
  name: string          // code variable name, e.g. "circleSize"
  label: string         // semantic label, e.g. "Circle Size"
  semanticLabel: string // richer LLM-generated label, e.g. "controls how big the rings are"
  value: number
  min: number
  max: number
  step: number
}

export interface SketchNodeData extends Record<string, unknown> {
  title: string
  code: string
  library: LibraryType
  parameters: Parameter[]
  isRunning: boolean
  sourcePrompt?: string
  error?: string
  generationKey: number
}

export interface OperatorNodeData extends Record<string, unknown> {
  operatorType: OperatorType
  prompt: string
  isGenerating: boolean
  suggestions: string[]
  diffText?: string
  sourceNodeIds: string[]
  targetNodeId?: string
  autoGenerate?: boolean   // triggers generation on mount (e.g. param-transfer)
  paramTransferLabel?: string  // human-readable label carried for param-transfer ops
}

export type SketchNode   = Node<SketchNodeData, 'sketch'>
export type OperatorNode = Node<OperatorNodeData, 'operator'>
export type AppNode      = SketchNode | OperatorNode

// Edge kinds: 'normal' | 'param-transfer' (light dashed, background)
export type AppEdgeKind = 'normal' | 'param-transfer'
export type AppEdge     = Edge & { data?: { kind?: AppEdgeKind } }

export interface ExampleSketch {
  id: string
  title: string
  description: string
  code: string
  library: LibraryType
}
