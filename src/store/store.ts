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
  Parameter,
  LibraryType,
  OperatorType,
} from '../utils/types'
import { CONCENTRIC_CIRCLES, TORUS } from '../utils/templates'
import { extractParameters, updateParameterInCode } from '../utils/codeUtils'
import { defaultProviderAndModel } from '../api/providers'

// ─── LocalStorage keys ────────────────────────────────────────────────────────
const STORAGE_KEYS     = 'melanie_api_keys'    // JSON: Record<providerId, apiKey>
const STORAGE_PROVIDER = 'melanie_provider'
const STORAGE_MODEL    = 'melanie_model'

function loadKeys(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS) ?? '{}') } catch { return {} }
}

const { providerId: DEFAULT_PROVIDER, modelId: DEFAULT_MODEL } = defaultProviderAndModel()

// ─── Initial graph ────────────────────────────────────────────────────────────
const rootCode   = CONCENTRIC_CIRCLES
const rootParams = extractParameters(rootCode)

const initialNodes: AppNode[] = [
  {
    id: 'root',
    type: 'sketch',
    position: { x: 80, y: 80 },
    data: {
      title: 'Sketch 0',
      code: rootCode,
      library: 'p5js',
      parameters: rootParams,
      isRunning: true,
      generationKey: 0,
    },
  },
]

// ─── Parameter-drag state (shared across nodes via store) ─────────────────────
export interface DraggingParam {
  sourceNodeId: string
  param: Parameter
  sourceCode: string
}

// ─── Store interface ──────────────────────────────────────────────────────────
interface MelanieStore {
  // Multi-provider auth
  apiKeys:    Record<string, string>
  providerId: string
  modelId:    string
  setApiKey:    (providerId: string, key: string) => void
  setProvider:  (providerId: string) => void
  setModel:     (modelId: string) => void
  getActiveKey: () => string

  // ReactFlow graph
  nodes: AppNode[]
  edges: AppEdge[]
  onNodesChange: OnNodesChange<AppNode>
  onEdgesChange: OnEdgesChange<AppEdge>

  // UI state
  activeCodeNodeId:  string | null
  mergingSourceId:   string | null
  pendingOpType:     'merge' | 'diff' | null
  draggingParam:     DraggingParam | null
  pendingToolbarOp:  OperatorType | null
  setActiveCodeNodeId:  (id: string | null) => void
  setMergingSourceId:   (id: string | null, opType?: 'merge' | 'diff') => void
  setDraggingParam:     (p: DraggingParam | null) => void
  setPendingToolbarOp:  (op: OperatorType | null) => void

  // Node CRUD
  addSketchNode: (opts: {
    code?: string; library?: LibraryType
    position?: { x: number; y: number }; title?: string; sourcePrompt?: string
  }) => string

  addOperatorNode: (opts: {
    operatorType: OperatorType; sourceNodeIds: string[]
    position: { x: number; y: number }
  }) => string

  addEdge: (edge: AppEdge) => void

  updateSketchCode:        (id: string, code: string) => void
  updateSketchParameters:  (id: string, params: Parameter[]) => void
  patchSketchParameter:    (id: string, name: string, value: number) => void
  updateSketchTitle:      (id: string, title: string) => void
  updateSketchRunning:    (id: string, running: boolean) => void
  reloadSketch:           (id: string) => void
  updateOperator:         (id: string, data: Partial<OperatorNodeData>) => void
  deleteNode:             (id: string) => void

  // Helpers
  getSketchNode:   (id: string) => SketchNodeData | undefined
  nextSketchTitle: () => string
  getNodePosition: (id: string) => { x: number; y: number } | undefined

  // Compat shim (old callers used apiKey / model)
  apiKey: string
  model:  string
}

export const useStore = create<MelanieStore>((set, get) => ({
  // ── auth ──
  apiKeys:    loadKeys(),
  providerId: localStorage.getItem(STORAGE_PROVIDER) ?? DEFAULT_PROVIDER,
  modelId:    localStorage.getItem(STORAGE_MODEL)    ?? DEFAULT_MODEL,

  setApiKey: (pid, key) => {
    const next = { ...get().apiKeys, [pid]: key }
    localStorage.setItem(STORAGE_KEYS, JSON.stringify(next))
    set({ apiKeys: next })
  },
  setProvider: (pid) => {
    localStorage.setItem(STORAGE_PROVIDER, pid)
    set({ providerId: pid })
  },
  setModel: (mid) => {
    localStorage.setItem(STORAGE_MODEL, mid)
    set({ modelId: mid })
  },
  getActiveKey: () => get().apiKeys[get().providerId] ?? '',

  // ── compat shims ──
  get apiKey() { return get().apiKeys[get().providerId] ?? '' },
  get model()  { return get().modelId },

  // ── graph ──
  nodes: initialNodes,
  edges: [],
  onNodesChange: (changes) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) as AppNode[] })),
  onEdgesChange: (changes) =>
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),

  // ── UI ──
  activeCodeNodeId:  null,
  mergingSourceId:   null,
  pendingOpType:     null,
  draggingParam:     null,
  pendingToolbarOp:  null,

  setActiveCodeNodeId: (id) => set({ activeCodeNodeId: id }),
  setMergingSourceId: (id, opType = 'merge') =>
    set({ mergingSourceId: id, pendingOpType: id ? opType : null }),
  setDraggingParam:    (p)  => set({ draggingParam: p }),
  setPendingToolbarOp: (op) => set({ pendingToolbarOp: op }),

  // ── node CRUD ──
  addSketchNode: ({ code, library = 'p5js', position = { x: 200, y: 200 }, title, sourcePrompt }) => {
    const id = nanoid(8)
    const resolved = code ?? (library === 'p5js' ? CONCENTRIC_CIRCLES : TORUS)
    const newNode: AppNode = {
      id, type: 'sketch', position,
      data: {
        title: title ?? get().nextSketchTitle(),
        code: resolved, library,
        parameters: extractParameters(resolved),
        isRunning: true, sourcePrompt, generationKey: 0,
      },
    }
    set((s) => ({ nodes: [...s.nodes, newNode] }))
    return id
  },

  addOperatorNode: ({ operatorType, sourceNodeIds, position }) => {
    const id = nanoid(8)
    const newNode: AppNode = {
      id, type: 'operator', position,
      data: { operatorType, prompt: '', isGenerating: false, suggestions: [], sourceNodeIds },
    }
    set((s) => ({ nodes: [...s.nodes, newNode] }))
    return id
  },

  addEdge: (edge) => set((s) => ({ edges: [...s.edges, edge] })),

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

  // Patch a single parameter value without recalculating min/max bounds.
  // This keeps the slider range stable while the user is dragging.
  patchSketchParameter: (id, name, value) =>
    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (n.id !== id || n.type !== 'sketch') return n
        const newCode   = updateParameterInCode(n.data.code as string, name, value)
        const newParams = (n.data.parameters as Parameter[]).map((p) =>
          p.name === name ? { ...p, value } : p
        )
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

  deleteNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
    })),

  getSketchNode: (id) => {
    const n = get().nodes.find((n) => n.id === id && n.type === 'sketch')
    return n?.type === 'sketch' ? (n.data as SketchNodeData) : undefined
  },

  nextSketchTitle: () => {
    const count = get().nodes.filter((n) => n.type === 'sketch').length
    return `Sketch ${count}`
  },

  getNodePosition: (id) => get().nodes.find((n) => n.id === id)?.position,
}))
