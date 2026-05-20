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

// Semantic axis — a Photoshop-style "latent knob" that re-prompts the model
// rather than tweaking a variable. The LLM proposes 3-4 axes per sketch with
// two opposing poles; scrubbing the slider interpolates between them.
export interface SemanticAxis {
  id: string
  leftLabel:  string   // e.g. "chaos"
  rightLabel: string   // e.g. "order"
  leftPrompt:  string  // one-line description of the left pole
  rightPrompt: string  // one-line description of the right pole
  value: number        // 0..1 (0 = full left, 0.5 = neutral, 1 = full right)
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
  // Optional persisted node dimensions (controlled by NodeResizer)
  width?:  number
  height?: number
  // LLM-proposed latent axes (chaos/order, dense/sparse, …) — scrubbing
  // them re-prompts the model rather than tweaking a variable.
  semanticAxes?:  SemanticAxis[]
  axesBaseline?:  string   // code snapshot the axes were generated against
  axesGenerating?: boolean // true while LLM is regenerating from a scrub
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
  // Optional human-friendly labels keyed by variable name. Applied to the
  // extracted parameters when the example is added to the canvas, so sliders
  // show readable labels instead of technical camelCase names.
  semanticLabels?: Record<string, string>
}
