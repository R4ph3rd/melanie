import type { Node, Edge } from '@xyflow/react'

export type LibraryType = 'p5js' | 'threejs'
export type OperatorType = 'modify' | 'duplicate' | 'merge' | 'diff' | 'extract'

export interface Parameter {
  name: string
  label: string
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
  generationKey: number // incremented to force iframe reload
}

export interface OperatorNodeData extends Record<string, unknown> {
  operatorType: OperatorType
  prompt: string
  isGenerating: boolean
  suggestions: string[]
  diffText?: string
  sourceNodeIds: string[]
  targetNodeId?: string
}

export type SketchNode = Node<SketchNodeData, 'sketch'>
export type OperatorNode = Node<OperatorNodeData, 'operator'>
export type AppNode = SketchNode | OperatorNode
export type AppEdge = Edge

export interface ExampleSketch {
  id: string
  title: string
  description: string
  code: string
  library: LibraryType
}

export interface AppSettings {
  apiKey: string
  model: string
}
