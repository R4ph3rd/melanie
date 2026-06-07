import type { Node, Edge } from '@xyflow/react'

export type LibraryType  = 'p5js' | 'threejs'
export type OperatorType = 'modify' | 'duplicate' | 'merge' | 'diff' | 'extract'
export type LFOShape     = 'sine' | 'square' | 'saw' | 'triangle'

export type SourceType =
  | 'lfo' | 'clock' | 'noise' | 'pattern' | 'random'
  | 'audio' | 'audio-fft' | 'audio-beat'
  | 'mouse' | 'keyboard' | 'scroll' | 'midi'
  | 'webcam'
  | 'constant'

export const SOURCE_CHANNELS: Record<SourceType, string[]> = {
  lfo:          ['value'],
  clock:        ['phase', 'beat'],
  noise:        ['value'],
  pattern:      ['value', 'step'],
  random:       ['value'],
  audio:        ['level'],
  'audio-fft':  ['sub', 'bass', 'mid', 'treble', 'presence'],
  'audio-beat': ['beat', 'energy'],
  mouse:        ['x', 'y', 'click', 'speed'],
  keyboard:     ['held', 'press'],
  scroll:       ['y', 'velocity'],
  midi:         ['note', 'velocity', 'active', 'cc'],
  webcam:       ['brightness', 'r', 'g', 'b', 'motion'],
  constant:     ['value'],
}

export interface Parameter {
  name: string
  label: string
  semanticLabel: string
  value: number
  min: number
  max: number
  step: number
  kind?: 'number' | 'color'   // default 'number'
  colorValue?: string          // hex string when kind === 'color'
}

export interface SemanticAxis {
  id: string
  leftLabel:   string
  rightLabel:  string
  leftPrompt:  string
  rightPrompt: string
  value: number
}

export interface SignalBinding {
  id:           string
  sourceNodeId: string
  channel:      string
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
  semanticAxes?:   SemanticAxis[]
  axesBaseline?:   string
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
  live?: boolean   // opt-in: re-run automatically when a source sketch changes
}

export interface SourceNodeData extends Record<string, unknown> {
  sourceType: SourceType
  // LFO
  rate?: number; shape?: LFOShape; amplitude?: number; offset?: number
  // Clock / Pattern
  bpm?: number
  // Noise
  freq?: number
  // Pattern
  steps?: number[]; length?: number
  // Random
  smooth?: boolean
  // Constant / runtime scalar
  value?: number
}

export type SketchNode   = Node<SketchNodeData, 'sketch'>
export type OperatorNode = Node<OperatorNodeData, 'operator'>
export type SourceNode   = Node<SourceNodeData, 'source'>
export type AppNode      = SketchNode | OperatorNode | SourceNode

export type AppEdgeKind = 'normal' | 'param-transfer' | 'signal'
export type AppEdge     = Edge & { data?: { kind?: AppEdgeKind; bindingId?: string; inert?: boolean } }

export interface ExampleSketch {
  id: string
  title: string
  description: string
  code: string
  library: LibraryType
  semanticLabels?: Record<string, string>
}
