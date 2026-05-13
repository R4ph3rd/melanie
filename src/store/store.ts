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
import { DEFAULT_P5_CODE, DEFAULT_THREEJS_CODE } from '../utils/templates'
import { extractParameters } from '../utils/codeUtils'
import { DEFAULT_MODEL } from '../api/claude'

const STORAGE_API_KEY = 'melanie_api_key'
const STORAGE_MODEL   = 'melanie_model'

const rootCode = DEFAULT_P5_CODE
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

interface melanieStore {
  // Persisted settings
  apiKey: string
  model: string
  setApiKey: (k: string) => void
  setModel:  (m: string) => void

  // ReactFlow graph state
  nodes: AppNode[]
  edges: AppEdge[]
  onNodesChange: OnNodesChange<AppNode>
  onEdgesChange: OnEdgesChange<AppEdge>

  // UI state
  activeCodeNodeId: string | null
  mergingSourceId: string | null
  pendingOpType: 'merge' | 'diff' | null
  setActiveCodeNodeId: (id: string | null) => void
  setMergingSourceId: (id: string | null, opType?: 'merge' | 'diff') => void

  // Node operations
  addSketchNode: (opts: {
    code?: string
    library?: LibraryType
    position?: { x: number; y: number }
    title?: string
    sourcePrompt?: string
  }) => string

  addOperatorNode: (opts: {
    operatorType: OperatorType
    sourceNodeIds: string[]
    position: { x: number; y: number }
  }) => string

  addEdge: (edge: AppEdge) => void

  updateSketchCode:       (id: string, code: string) => void
  updateSketchParameters: (id: string, params: Parameter[]) => void
  updateSketchTitle:      (id: string, title: string) => void
  updateSketchRunning:    (id: string, running: boolean) => void
  reloadSketch:           (id: string) => void

  updateOperator: (id: string, data: Partial<OperatorNodeData>) => void

  deleteNode: (id: string) => void

  // Helpers
  getSketchNode: (id: string) => SketchNodeData | undefined
  nextSketchTitle: () => string
  getNodePosition: (id: string) => { x: number; y: number } | undefined
}

let sketchCounter = 1

export const useStore = create<melanieStore>((set, get) => ({
  apiKey: localStorage.getItem(STORAGE_API_KEY) ?? '',
  model:  localStorage.getItem(STORAGE_MODEL)   ?? DEFAULT_MODEL,

  setApiKey: (k) => {
    localStorage.setItem(STORAGE_API_KEY, k)
    set({ apiKey: k })
  },
  setModel: (m) => {
    localStorage.setItem(STORAGE_MODEL, m)
    set({ model: m })
  },

  nodes: initialNodes,
  edges: [],

  onNodesChange: (changes) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) as AppNode[] })),
  onEdgesChange: (changes) =>
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),

  activeCodeNodeId: null,
  mergingSourceId:  null,
  pendingOpType:    null,
  setActiveCodeNodeId: (id) => set({ activeCodeNodeId: id }),
  setMergingSourceId:  (id, opType = 'merge') =>
    set({ mergingSourceId: id, pendingOpType: id ? opType : null }),

  addSketchNode: ({ code, library = 'p5js', position = { x: 200, y: 200 }, title, sourcePrompt }) => {
    const id = nanoid(8)
    const resolvedCode = code ?? (library === 'p5js' ? DEFAULT_P5_CODE : DEFAULT_THREEJS_CODE)
    const nodeTitle = title ?? get().nextSketchTitle()
    const newNode: AppNode = {
      id,
      type: 'sketch',
      position,
      data: {
        title: nodeTitle,
        code: resolvedCode,
        library,
        parameters: extractParameters(resolvedCode),
        isRunning: true,
        sourcePrompt,
        generationKey: 0,
      },
    }
    set((s) => ({ nodes: [...s.nodes, newNode] }))
    return id
  },

  addOperatorNode: ({ operatorType, sourceNodeIds, position }) => {
    const id = nanoid(8)
    const newNode: AppNode = {
      id,
      type: 'operator',
      position,
      data: {
        operatorType,
        prompt: '',
        isGenerating: false,
        suggestions: [],
        sourceNodeIds,
      },
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
        n.id === id && n.type === 'sketch'
          ? { ...n, data: { ...n.data, parameters: params } }
          : n
      ),
    })),

  updateSketchTitle: (id, title) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id && n.type === 'sketch'
          ? { ...n, data: { ...n.data, title } }
          : n
      ),
    })),

  updateSketchRunning: (id, isRunning) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id && n.type === 'sketch'
          ? { ...n, data: { ...n.data, isRunning } }
          : n
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
        n.id === id && n.type === 'operator'
          ? { ...n, data: { ...n.data, ...data } }
          : n
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
    sketchCounter = count
    return `Sketch ${count}`
  },

  getNodePosition: (id) => get().nodes.find((n) => n.id === id)?.position,
}))
