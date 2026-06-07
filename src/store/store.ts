import { create } from 'zustand'
import {
  applyNodeChanges,
  applyEdgeChanges,
  type OnNodesChange,
  type OnEdgesChange,
} from '@xyflow/react'
import { nanoid } from 'nanoid'
import type {
  AppNode,
  AppEdge,
  SketchNodeData,
  OperatorNodeData,
  SourceNodeData,
  SourceType,
  Parameter,
  LibraryType,
  OperatorType,
  SemanticAxis,
  SignalBinding,
} from '../utils/types'
import { clearNodeSignals, clearAllSignals } from './signals'
import { CONCENTRIC_CIRCLES, TORUS } from '../utils/templates'
import { extractParameters, updateParameterInCode, applySemanticLabels } from '../utils/codeUtils'
import { defaultProviderAndModel } from '../api/providers'

const STORAGE_KEYS     = 'melanie_api_keys'
const STORAGE_PROVIDER = 'melanie_provider'
const STORAGE_MODEL    = 'melanie_model'

function loadKeys(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS) ?? '{}') } catch { return {} }
}

// True if adding source→target would create a directed cycle (target can already reach source).
function createsCycle(edges: AppEdge[], source: string, target: string): boolean {
  if (source === target) return true
  const adj = new Map<string, string[]>()
  for (const e of edges) {
    if (e.data?.kind && e.data.kind !== 'normal') continue
    if (!e.source || !e.target) continue
    ;(adj.get(e.source) ?? adj.set(e.source, []).get(e.source)!).push(e.target)
  }
  const seen = new Set<string>()
  const stack = [target]
  while (stack.length) {
    const node = stack.pop()!
    if (node === source) return true
    if (seen.has(node)) continue
    seen.add(node)
    for (const next of adj.get(node) ?? []) stack.push(next)
  }
  return false
}

const { providerId: DEFAULT_PROVIDER, modelId: DEFAULT_MODEL } = defaultProviderAndModel()

const rootCode   = CONCENTRIC_CIRCLES
const rootParams = applySemanticLabels(extractParameters(rootCode), {
  numCircles:   'How many rings',
  circleSize:   'Spacing between rings',
  strokeW:      'Line thickness',
  bgBrightness: 'Background brightness',
})

const initialNodes: AppNode[] = [
  {
    id: 'root', type: 'sketch', position: { x: 80, y: 80 },
    data: { title: 'Sketch 0', code: rootCode, library: 'p5js', parameters: rootParams, isRunning: true, generationKey: 0 },
  },
]

export interface DraggingParam {
  sourceNodeId: string
  param: Parameter
  sourceCode: string
}

interface MelanieStore {
  apiKeys:    Record<string, string>
  providerId: string
  modelId:    string
  setApiKey:    (providerId: string, key: string) => void
  setProvider:  (providerId: string) => void
  setModel:     (modelId: string) => void
  getActiveKey: () => string

  nodes: AppNode[]
  edges: AppEdge[]
  onNodesChange: OnNodesChange<AppNode>
  onEdgesChange: OnEdgesChange<AppEdge>

  activeCodeNodeId:    string | null
  mergingSourceId:     string | null
  pendingOpType:       'merge' | 'diff' | null
  draggingParam:       DraggingParam | null
  pendingToolbarOp:    OperatorType | null
  backgroundSketchId:  string | null
  setActiveCodeNodeId:   (id: string | null) => void
  setMergingSourceId:    (id: string | null, opType?: 'merge' | 'diff') => void
  setDraggingParam:      (p: DraggingParam | null) => void
  setPendingToolbarOp:   (op: OperatorType | null) => void
  setBackgroundSketchId: (id: string | null) => void

  addSketchNode: (opts: {
    code?: string; library?: LibraryType
    position?: { x: number; y: number }; title?: string; sourcePrompt?: string
    semanticLabels?: Record<string, string>
  }) => string
  addOperatorNode: (opts: { operatorType: OperatorType; sourceNodeIds: string[]; position: { x: number; y: number } }) => string
  addSourceNode:   (opts: { sourceType: SourceType; position: { x: number; y: number } }) => string
  addEdge: (edge: AppEdge) => void

  updateSketchCode:       (id: string, code: string) => void
  updateSketchParameters: (id: string, params: Parameter[]) => void
  patchSketchParameter:   (id: string, name: string, value: number) => void
  updateSketchTitle:      (id: string, title: string) => void
  updateSketchRunning:    (id: string, running: boolean) => void
  updateSketchDims:       (id: string, width: number, height: number) => void
  setSketchAxes:          (id: string, axes: SemanticAxis[], baseline: string) => void
  patchAxisValue:         (id: string, axisId: string, value: number) => void
  setAxesGenerating:      (id: string, generating: boolean) => void
  reloadSketch:           (id: string) => void
  updateOperator:         (id: string, data: Partial<OperatorNodeData>) => void
  updateSource:           (id: string, data: Partial<SourceNodeData>) => void
  deleteNode:             (id: string) => void

  getSketchNode:   (id: string) => SketchNodeData | undefined
  nextSketchTitle: () => string
  getNodePosition: (id: string) => { x: number; y: number } | undefined
  resetCanvas: () => void

  // Signal flow
  signalBindings:      SignalBinding[]
  addSignalBinding:    (binding: Omit<SignalBinding, 'id'>) => string
  removeSignalBinding: (id: string) => void

  // Compat shims
  apiKey: string
  model:  string
}

export const useStore = create<MelanieStore>((set, get) => ({
  apiKeys:    loadKeys(),
  providerId: localStorage.getItem(STORAGE_PROVIDER) ?? DEFAULT_PROVIDER,
  modelId:    localStorage.getItem(STORAGE_MODEL)    ?? DEFAULT_MODEL,

  setApiKey: (pid, key) => {
    const next = { ...get().apiKeys, [pid]: key }
    localStorage.setItem(STORAGE_KEYS, JSON.stringify(next))
    set({ apiKeys: next })
  },
  setProvider: (pid) => { localStorage.setItem(STORAGE_PROVIDER, pid); set({ providerId: pid }) },
  setModel:    (mid) => { localStorage.setItem(STORAGE_MODEL, mid);    set({ modelId: mid }) },
  getActiveKey: () => get().apiKeys[get().providerId] ?? '',

  get apiKey() { return get().apiKeys[get().providerId] ?? '' },
  get model()  { return get().modelId },

  nodes: initialNodes,
  edges: [],
  onNodesChange: (changes) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) as AppNode[] })),
  onEdgesChange: (changes) =>
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),

  activeCodeNodeId:   null,
  mergingSourceId:    null,
  pendingOpType:      null,
  draggingParam:      null,
  pendingToolbarOp:   null,
  backgroundSketchId: null,

  setActiveCodeNodeId: (id) => set({ activeCodeNodeId: id }),
  setMergingSourceId: (id, opType = 'merge') =>
    set({ mergingSourceId: id, pendingOpType: id ? opType : null }),
  setDraggingParam:      (p)  => set({ draggingParam: p }),
  setPendingToolbarOp:   (op) => set({ pendingToolbarOp: op }),
  setBackgroundSketchId: (id) => set({ backgroundSketchId: id }),

  addSketchNode: ({ code, library = 'p5js', position = { x: 200, y: 200 }, title, sourcePrompt, semanticLabels }) => {
    const id = nanoid(8)
    const resolved   = code ?? (library === 'p5js' ? CONCENTRIC_CIRCLES : TORUS)
    const baseParams = extractParameters(resolved)
    const parameters = semanticLabels ? applySemanticLabels(baseParams, semanticLabels) : baseParams
    set((s) => ({
      nodes: [...s.nodes, {
        id, type: 'sketch', position,
        data: { title: title ?? get().nextSketchTitle(), code: resolved, library, parameters, isRunning: true, sourcePrompt, generationKey: 0 },
      } as AppNode],
    }))
    return id
  },

  addOperatorNode: ({ operatorType, sourceNodeIds, position }) => {
    const id = nanoid(8)
    set((s) => ({
      nodes: [...s.nodes, {
        id, type: 'operator', position,
        data: { operatorType, prompt: '', isGenerating: false, suggestions: [], sourceNodeIds },
      } as AppNode],
    }))
    return id
  },

  addSourceNode: ({ sourceType, position }) => {
    const id = nanoid(8)
    const DEFAULTS: Partial<Record<SourceType, Partial<SourceNodeData>>> = {
      lfo:          { rate: 0.5, shape: 'sine', amplitude: 1, offset: 0 },
      clock:        { bpm: 120 },
      noise:        { freq: 0.5 },
      pattern:      { bpm: 120, length: 8, steps: Array(8).fill(0) },
      random:       { freq: 2, smooth: true },
      constant:     { value: 0.5 },
    }
    const defaults = DEFAULTS[sourceType] ?? {}
    set((s) => ({
      nodes: [...s.nodes, { id, type: 'source', position, data: { sourceType, ...defaults } } as AppNode],
    }))
    return id
  },

  addEdge: (edge) => set((s) => {
    // Reject data-flow edges that would close a cycle — they'd cause cascade
    // re-runs to ping-pong forever and silently burn the user's API budget.
    // Signal/param-transfer edges are display-only and never cascade, so allow them.
    const isDataEdge = !edge.data?.kind || edge.data.kind === 'normal'
    if (isDataEdge && edge.source && edge.target && createsCycle(s.edges, edge.source, edge.target)) {
      console.warn(`Edge ${edge.source}→${edge.target} skipped: would create a cycle`)
      return s
    }
    return { edges: [...s.edges, edge] }
  }),

  updateSketchCode: (id, code) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id && n.type === 'sketch'
          ? { ...n, data: { ...n.data, code, parameters: extractParameters(code), error: undefined } }
          : n
      ),
    })),

  updateSketchParameters: (id, params) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id && n.type === 'sketch' ? { ...n, data: { ...n.data, parameters: params } } : n
      ),
    })),

  patchSketchParameter: (id, name, value) =>
    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (n.id !== id || n.type !== 'sketch') return n
        const newCode   = updateParameterInCode(n.data.code as string, name, value)
        const newParams = (n.data.parameters as Parameter[]).map((p) => p.name === name ? { ...p, value } : p)
        return { ...n, data: { ...n.data, code: newCode, parameters: newParams } }
      }),
    })),

  updateSketchTitle: (id, title) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id && n.type === 'sketch' ? { ...n, data: { ...n.data, title } } : n
      ),
    })),

  updateSketchRunning: (id, isRunning) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id && n.type === 'sketch' ? { ...n, data: { ...n.data, isRunning } } : n
      ),
    })),

  updateSketchDims: (id, width, height) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id && n.type === 'sketch' ? { ...n, data: { ...n.data, width, height } } : n
      ),
    })),

  setSketchAxes: (id, axes, baseline) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id && n.type === 'sketch'
          ? { ...n, data: { ...n.data, semanticAxes: axes, axesBaseline: baseline } }
          : n
      ),
    })),

  patchAxisValue: (id, axisId, value) =>
    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (n.id !== id || n.type !== 'sketch') return n
        const axes = (n.data.semanticAxes as SemanticAxis[] | undefined) ?? []
        return { ...n, data: { ...n.data, semanticAxes: axes.map((a) => a.id === axisId ? { ...a, value } : a) } }
      }),
    })),

  setAxesGenerating: (id, generating) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id && n.type === 'sketch' ? { ...n, data: { ...n.data, axesGenerating: generating } } : n
      ),
    })),

  reloadSketch: (id) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id && n.type === 'sketch'
          ? { ...n, data: { ...n.data, generationKey: (n.data.generationKey as number) + 1 } }
          : n
      ),
    })),

  updateOperator: (id, data) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id && n.type === 'operator' ? { ...n, data: { ...n.data, ...data } } : n
      ),
    })),

  updateSource: (id, data) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id && n.type === 'source' ? { ...n, data: { ...n.data, ...data } } : n
      ),
    })),

  deleteNode: (id) => {
    clearNodeSignals(id)
    set((s) => ({
      nodes:          s.nodes.filter((n) => n.id !== id),
      edges:          s.edges.filter((e) => e.source !== id && e.target !== id),
      signalBindings: s.signalBindings.filter((b) => b.sourceNodeId !== id && b.targetNodeId !== id),
      backgroundSketchId: s.backgroundSketchId === id ? null : s.backgroundSketchId,
    }))
  },

  getSketchNode: (id) => {
    const n = get().nodes.find((n) => n.id === id && n.type === 'sketch')
    return n ? (n.data as SketchNodeData) : undefined
  },

  nextSketchTitle: () => `Sketch ${get().nodes.filter((n) => n.type === 'sketch').length}`,

  getNodePosition: (id) => get().nodes.find((n) => n.id === id)?.position,

  resetCanvas: () => {
    clearAllSignals()
    set({
      nodes: [], edges: [], signalBindings: [],
      activeCodeNodeId: null, mergingSourceId: null, pendingOpType: null,
      draggingParam: null, pendingToolbarOp: null, backgroundSketchId: null,
    })
  },

  // ── Signal flow ───────────────────────────────────────────────────────────────
  signalBindings: [],

  addSignalBinding: (binding) => {
    const id = nanoid(6)
    set((s) => ({ signalBindings: [...s.signalBindings, { ...binding, id }] }))
    return id
  },

  removeSignalBinding: (id) =>
    set((s) => ({ signalBindings: s.signalBindings.filter((b) => b.id !== id) })),
}))
