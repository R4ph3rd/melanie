import type { OperatorType, SourceType, LibraryType } from './types'

// Single source of truth for the add-node menu: categories, their colors, and
// which nodes live where. One color per category (in the menu *and* on canvas) —
// the sole exception is Operators, whose tab is neutral but whose nodes keep
// their own per-op colors. Effects is the home for feedback and the
// TouchDesigner-TOP-style nodes that will grow over time.

export type NodeCategory = 'operators' | 'sketches' | 'generators' | 'inputs' | 'effects'

export const CATEGORY_ORDER: NodeCategory[] = ['operators', 'sketches', 'generators', 'inputs', 'effects']

export const CATEGORY_LABELS: Record<NodeCategory, string> = {
  operators:  'Operators',
  sketches:   'Sketches',
  generators: 'Generators',
  inputs:     'Inputs',
  effects:    'Fx',
}

// Tab + node tint per category. Operators is neutral (nodes keep own colors).
export const CATEGORY_COLORS: Record<NodeCategory, string> = {
  operators:  '#9aa0a6',
  sketches:   '#8C49DF',
  generators: '#0ea5e9',
  inputs:     '#10b981',
  effects:    '#f97316',
}

// ── Operators ───────────────────────────────────────────────────────────────
export interface OperatorEntry { type: OperatorType; label: string; icon: string; color: string }

export const OPERATORS: OperatorEntry[] = [
  { type: 'modify',    label: 'Modify',  icon: 'modify',    color: '#8C49DF' },
  { type: 'merge',     label: 'Merge',   icon: 'merge',     color: '#1d4ed8' },
  { type: 'diff',      label: 'Diff',    icon: 'diff',      color: '#047857' },
  { type: 'extract',   label: 'Extract', icon: 'extract',   color: '#b45309' },
  { type: 'duplicate', label: 'Clone',   icon: 'duplicate', color: '#ca8a04' },
]

// ── Sources (generators, inputs, effects) ─────────────────────────────────────
export interface SourceEntry { sourceType: SourceType; label: string; category: NodeCategory }

export const SOURCES: SourceEntry[] = [
  // Generators — synthetic signals
  { sourceType: 'lfo',             label: 'LFO',        category: 'generators' },
  { sourceType: 'clock',           label: 'Clock',      category: 'generators' },
  { sourceType: 'noise',           label: 'Noise',      category: 'generators' },
  { sourceType: 'pattern',         label: 'Pattern',    category: 'generators' },
  { sourceType: 'random',          label: 'Random',     category: 'generators' },
  { sourceType: 'constant',        label: 'Constant',   category: 'generators' },
  // Inputs — real-world signals
  { sourceType: 'audio',           label: 'Mic Level',  category: 'inputs' },
  { sourceType: 'audio-fft',       label: 'Audio FFT',  category: 'inputs' },
  { sourceType: 'audio-beat',      label: 'Audio Beat', category: 'inputs' },
  { sourceType: 'mouse',           label: 'Mouse',      category: 'inputs' },
  { sourceType: 'keyboard',        label: 'Keyboard',   category: 'inputs' },
  { sourceType: 'scroll',          label: 'Scroll',     category: 'inputs' },
  { sourceType: 'midi',            label: 'MIDI',       category: 'inputs' },
  { sourceType: 'webcam',          label: 'Webcam',     category: 'inputs' },
  { sourceType: 'video',           label: 'Video In',   category: 'inputs' },
  // Effects — TOP-style processors
  { sourceType: 'video-threshold', label: 'Threshold',  category: 'effects' },
  { sourceType: 'video-edge',      label: 'Edge',       category: 'effects' },
]

const SOURCE_CATEGORY = Object.fromEntries(SOURCES.map((s) => [s.sourceType, s.category])) as Record<SourceType, NodeCategory>

// Canvas + menu tint for a source/effect node — derived from its category.
export function sourceColor(type: SourceType): string {
  return CATEGORY_COLORS[SOURCE_CATEGORY[type] ?? 'generators']
}

export function sourceCategory(type: SourceType): NodeCategory {
  return SOURCE_CATEGORY[type] ?? 'generators'
}

// ── Sketches ──────────────────────────────────────────────────────────────────
export interface SketchEntry { library: LibraryType; label: string }

export const SKETCHES: SketchEntry[] = [
  { library: 'p5js',    label: 'p5.js sketch' },
  { library: 'threejs', label: 'three.js sketch' },
]
