import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import Icon from './ui/Icon'
import type { SemanticAxis } from '../utils/types'
import { useStore } from '../store/store'
import { generate, generateText, isAbortError } from '../api/providers'
import { getSemanticAxesSystem, buildSemanticAxesMessages, getAxisScrubSystem, buildAxisScrubMessages } from '../prompts'

interface Props { nodeId: string }

const SCRUB_DEBOUNCE_MS = 700

const SemanticAxes = memo(function SemanticAxes({ nodeId }: Props) {
  const store     = useStore()
  const getSketch = useStore((s) => s.getSketchNode)
  const data      = getSketch(nodeId)

  const [discoverLoading, setDiscoverLoading] = useState(false)
  const scrubTimer = useRef<ReturnType<typeof setTimeout>>()
  const scrubAbort = useRef<AbortController | null>(null)

  // Cancel any in-flight scrub generation + pending debounce on unmount.
  useEffect(() => () => { scrubAbort.current?.abort(); clearTimeout(scrubTimer.current) }, [])

  const discoverAxes = useCallback(async () => {
    if (!data) return
    const apiKey = store.getActiveKey()
    if (!apiKey) { alert('Please add an API key via "Connect Models" in the top bar.'); return }
    setDiscoverLoading(true)
    try {
      const raw     = await generateText({ providerId: store.providerId, apiKey, modelId: store.modelId, system: getSemanticAxesSystem(), messages: buildSemanticAxesMessages(data.code, data.library, data.sourcePrompt) })
      const cleaned = raw.replace(/```[a-z]*\n?/g, '').replace(/```$/g, '').trim()
      const parsed  = JSON.parse(cleaned) as Omit<SemanticAxis, 'id' | 'value'>[]
      if (!Array.isArray(parsed)) throw new Error('Expected JSON array')
      const axes: SemanticAxis[] = parsed.slice(0, 4).map((a) => ({
        id:          nanoid(6),
        leftLabel:   String(a.leftLabel  ?? '').slice(0, 24),
        rightLabel:  String(a.rightLabel ?? '').slice(0, 24),
        leftPrompt:  String(a.leftPrompt  ?? ''),
        rightPrompt: String(a.rightPrompt ?? ''),
        value:       0.5,
      }))
      store.setSketchAxes(nodeId, axes, data.code)
    } catch (err) {
      console.error('Axes discovery error:', err)
      alert('Failed to discover axes — check the console for details.')
    } finally {
      setDiscoverLoading(false)
    }
  }, [nodeId, data, store])

  const regenerateFromAxes = useCallback(async () => {
    const fresh = store.getSketchNode(nodeId)
    if (!fresh?.semanticAxes || !fresh.axesBaseline) return
    const apiKey = store.getActiveKey()
    if (!apiKey) return
    // Abort the previous scrub before starting a new one: rapid scrubbing must
    // not pay for overlapping requests or risk an older response landing last.
    scrubAbort.current?.abort()
    const ac = new AbortController()
    scrubAbort.current = ac
    store.setAxesGenerating(nodeId, true)
    try {
      const newCode = await generate({ providerId: store.providerId, apiKey, modelId: store.modelId, system: getAxisScrubSystem(fresh.library), messages: buildAxisScrubMessages(fresh.axesBaseline, fresh.semanticAxes, fresh.library), maxTokens: 4096, signal: ac.signal })
      store.updateSketchCode(nodeId, newCode)
    } catch (err) {
      if (isAbortError(err)) return   // superseded by a newer scrub
      console.error('Axis scrub generation error:', err)
    } finally {
      if (scrubAbort.current === ac) { scrubAbort.current = null; store.setAxesGenerating(nodeId, false) }
    }
  }, [nodeId, store])

  const handleScrub = useCallback((axisId: string, value: number) => {
    store.patchAxisValue(nodeId, axisId, value)
    clearTimeout(scrubTimer.current)
    scrubTimer.current = setTimeout(regenerateFromAxes, SCRUB_DEBOUNCE_MS)
  }, [nodeId, store, regenerateFromAxes])

  const pinPole = useCallback(async (axis: SemanticAxis, side: 'left' | 'right') => {
    const fresh = store.getSketchNode(nodeId)
    if (!fresh?.axesBaseline) return
    const apiKey = store.getActiveKey()
    if (!apiKey) { alert('Please add an API key via "Connect Models" in the top bar.'); return }
    const polarAxes  = (fresh.semanticAxes ?? []).map((a) => a.id === axis.id ? { ...a, value: side === 'left' ? 0 : 1 } : a)
    const sourcePos  = store.getNodePosition(nodeId)
    const newTitle   = `${fresh.title} · ${side === 'left' ? axis.leftLabel : axis.rightLabel}`
    const newId      = store.addSketchNode({ code: '', library: fresh.library, position: { x: (sourcePos?.x ?? 200) + 360, y: (sourcePos?.y ?? 200) + (side === 'left' ? -180 : 180) }, title: newTitle })
    store.addEdge({ id: nanoid(6), source: nodeId, target: newId, sourceHandle: 'right', targetHandle: 'left' })
    try {
      const newCode = await generate({ providerId: store.providerId, apiKey, modelId: store.modelId, system: getAxisScrubSystem(fresh.library), messages: buildAxisScrubMessages(fresh.axesBaseline, polarAxes, fresh.library), maxTokens: 4096 })
      store.updateSketchCode(newId, newCode)
      store.setSketchAxes(newId, polarAxes, newCode)
    } catch (err) {
      console.error('Pin-pole generation error:', err)
    }
  }, [nodeId, store])

  if (!data) return null
  const axes        = data.semanticAxes ?? []
  const isGenerating = data.axesGenerating === true

  if (axes.length === 0) {
    return (
      <div className="nodrag nopan px-3 pb-2 pt-2 border-t border-border" onPointerDown={(e) => e.stopPropagation()}>
        <button onClick={discoverAxes} disabled={discoverLoading}
          className="w-full flex items-center justify-center gap-2 text-xs py-1.5 transition-colors"
          style={{ color: discoverLoading ? '#888' : '#a78bfa', background: 'rgba(140,73,223,0.08)', border: '1px solid rgba(140,73,223,0.35)', borderRadius: 2, cursor: discoverLoading ? 'wait' : 'pointer' }}
          title="Ask the LLM to propose 3-4 aesthetic axes for this sketch"
        >
          <Icon name={discoverLoading ? 'loading' : 'discover-axes'} size={12} className={discoverLoading ? 'animate-spin' : ''} />
          {discoverLoading ? 'Discovering axes…' : 'Discover semantic axes'}
        </button>
      </div>
    )
  }

  return (
    <div className="nodrag nopan px-3 pb-2 pt-2 space-y-2 border-t border-border" onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <span className="text-2xs uppercase tracking-wider text-text-muted flex items-center gap-1">
          <Icon name="discover-axes" size={10} />
          Semantic axes
        </span>
        <div className="flex items-center gap-2">
          {isGenerating && (
            <span className="text-2xs text-purple-300 flex items-center gap-1">
              <Icon name="loading" size={9} className="animate-spin" /> re-prompting
            </span>
          )}
          <button onClick={discoverAxes} disabled={discoverLoading}
            className="text-2xs text-text-muted hover:text-text-primary nodrag"
            title="Re-discover axes from scratch"
          >
            <Icon name={discoverLoading ? 'loading' : 'refresh'} size={11} className={discoverLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {axes.map((a) => (
        <div key={a.id} className="space-y-0.5">
          <div className="flex items-center justify-between text-2xs">
            <button className="flex items-center gap-1 text-purple-300 hover:text-purple-200 nodrag truncate"
              onClick={() => pinPole(a, 'left')}
              title={`Pin "${a.leftLabel}" pole as a new branch sketch\n\n${a.leftPrompt}`}
              style={{ maxWidth: '40%' }}
            >
              <Icon name="open-new-node" size={10} style={{ opacity: 0.5 }} />
              <span className="truncate">{a.leftLabel}</span>
            </button>
            <button className="flex items-center gap-1 text-purple-300 hover:text-purple-200 nodrag truncate"
              onClick={() => pinPole(a, 'right')}
              title={`Pin "${a.rightLabel}" pole as a new branch sketch\n\n${a.rightPrompt}`}
              style={{ maxWidth: '40%' }}
            >
              <span className="truncate">{a.rightLabel}</span>
              <Icon name="open-new-node" size={10} style={{ opacity: 0.5 }} />
            </button>
          </div>
          <input type="range" min={0} max={1} step={0.01} value={a.value}
            onChange={(e) => handleScrub(a.id, parseFloat(e.target.value))}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-full h-1 cursor-pointer nodrag nopan"
            style={{ accentColor: '#8C49DF' }}
          />
        </div>
      ))}
    </div>
  )
})

export default SemanticAxes
