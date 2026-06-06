import type { Node, Edge } from '@xyflow/react'

export type LibraryType = 'p5js' | 'threejs'
export type OperatorType = 'modify' | 'duplicate' | 'merge' | 'diff' | 'extract'
export type SourceType   = 'lfo' | 'audio' | 'clock'
export type LFOShape     = 'sine' | 'square' | 'saw' | 'triangle'

export interface Parameter {
  name: string          // code variable name, e.g. "circleSize"
  label: string         // semantic label, e.g. "Circle Size"
  semanticLabel: string // richer LLM-generated label
  value: number
  min: number
  max: number
  step: number
}

// Semantic axis — a latent knob that re-prompts the model rather than tweaking a variable.
export interface SemanticAxis {
  id: string
  leftLabel:  string
  rightLabel: string
  leftPrompt:  string
  rightPrompt: string
  value: number  // 0..1
}

// Signal binding: a live wire from a source node channel to a sketch parameter.
export interface SignalBinding {
  id:           string
  sourceNodeId: string
  channel:      string   // 'value', 'level', 'beat', 'phase', or sketch output channel
  targetNodeId: string
  paramName:    string
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
  width?:  number
  height?: number
  semanticAxes?:  SemanticAxis[]
  axesBaseline?:  string
  axesGenerating?: boolean
}

export interface OperatorNodeData extends Record<string, unknown> {
  operatorType: OperatorType
  prompt: string
  isGenerating: boolean
  suggestions: string[]
  diffText?: string
  sourceNodeIds: string[]
  targetNodeId?: string
  autoGenerate?: boolean
  paramTransferLabel?: string
}

export interface SourceNodeData extends Record<string, unknown> {
  sourceType: SourceType
  // LFO
  rate?:      number    // Hz, 0.05–10
  shape?:     LFOShape
  amplitude?: number    // output scale 0–1
  offset?:    number    // center shift 0–1
  // Clock
  bpm?: number          // 20–300
  // Runtime (updated each frame)
  value?: number
}

export type SketchNode   = Node<SketchNodeData, 'sketch'>
export type OperatorNode = Node<OperatorNodeData, 'operator'>
export type SourceNode   = Node<SourceNodeData, 'source'>
export type AppNode      = SketchNode | OperatorNode | SourceNode

export type AppEdgeKind = 'normal' | 'param-transfer' | 'signal'
export type AppEdge     = Edge & { data?: { kind?: AppEdgeKind } }

export interface ExampleSketch {
  id: string
  title: string
  description: string
  code: string
  library: LibraryType
  semanticLabels?: Record<string, string>
}
