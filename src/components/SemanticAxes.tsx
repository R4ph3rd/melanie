/**
 * SemanticAxes — "Photoshop latent knobs" rendered inside sketch nodes.
 *
 * The LLM proposes 3-4 aesthetic axes specific to the current sketch (e.g.
 * "chaos / order", "biological / mechanical"). Each axis has two opposing
 * poles described in natural language. Scrubbing the slider re-prompts the
 * model from an interpolated position between the two pole descriptions
 * (NOT changing a code variable).
 *
 * Two persistence modes:
 *  • Live scrub  → debounced regenerate in place on the same sketch node
 *  • Pin pole    → spawn a new sketch node at value=0 or value=1 (history tree)
 */
import { memo, useCallback, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import Icon from './ui/Icon'
import type { SemanticAxis } from '../utils/types'
import { useStore } from '../store/store'
import { generate, generateText } from '../api/providers'
import {
  getSemanticAxesSystem,
  buildSemanticAxesMessages,
  getAxisScrubSystem,
  buildAxisScrubMessages,
} from '../prompts'

interface Props {
  nodeId: string
}

const SCRUB_DEBOUNCE_MS = 700

const SemanticAxes = memo(function SemanticAxes({ nodeId }: Props) {
  const store     = useStore()
  const getSketch = useStore((s) => s.getSketchNode)
  // Read fresh from the store each render so we always see the current axes /
  // baseline / generating flag for THIS node.
  const data = getSketch(nodeId)

  const [discoverLoading, setDiscoverLoading] = useState(false)
  const scrubTimer = useRef<ReturnType<typeof setTimeout>>()

  // ── Discover axes (LLM proposes 3-4 axes for this sketch) ───────────────
  const discoverAxes = useCallback(async () => {
    if (!data) return
    const apiKey = store.getActiveKey()
    if (!apiKey) { alert('Please add an API key via "Connect Models" in the top bar.'); return }
    setDiscoverLoading(true)
    try {
      const raw = await generateText({
        providerId: store.providerId,
        apiKey,
        modelId:    store.modelId,
        system:     getSemanticAxesSystem(),
        messages:   buildSemanticAxesMessages(data.code, data.library, data.sourcePrompt),
      })
      const cleaned = raw.replace(/```[a-z]*\n?/g, '').replace(/```$/g, '').trim()
      const parsed = JSON.parse(cleaned) as Omit<SemanticAxis, 'id' | 'value'>[]
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

  // ── Live scrub: debounced LLM re-prompt from the baseline ───────────────
  const regenerateFromAxes = useCallback(async () => {
    const fresh = store.getSketchNode(nodeId)
    if (!fresh?.semanticAxes || !fresh.axesBaseline) return
    const apiKey = store.getActiveKey()
    if (!apiKey) return
    store.setAxesGenerating(nodeId, true)
    try {
      const newCode = await generate({
        providerId: store.providerId,
        apiKey,
        modelId:    store.modelId,
        system:     getAxisScrubSystem(fresh.library),
        messages:   buildAxisScrubMessages(fresh.axesBaseline, fresh.semanticAxes, fresh.library),
        maxTokens:  4096,
      })
      store.updateSketchCode(nodeId, newCode)
    } catch (err) {
      console.error('Axis scrub generation error:', err)
    } finally {
      store.setAxesGenerating(nodeId, false)
    }
  }, [nodeId, store])

  const handleScrub = useCallback((axisId: string, value: number) => {
    store.patchAxisValue(nodeId, axisId, value)
    clearTimeout(scrubTimer.current)
    scrubTimer.current = setTimeout(regenerateFromAxes, SCRUB_DEBOUNCE_MS)
  }, [nodeId, store, regenerateFromAxes])

  // ── Pin a pole → spawn a new sketch node (history tree entry) ───────────
  const pinPole = useCallback(async (axis: SemanticAxis, side: 'left' | 'right') => {
    const fresh = store.getSketchNode(nodeId)
    if (!fresh?.axesBaseline) return
    const apiKey = store.getActiveKey()
    if (!apiKey) { alert('Please add an API key via "Connect Models" in the top bar.'); return }
    const polarAxes = (fresh.semanticAxes ?? []).map((a) => a.id === axis.id
      ? { ...a, value: side === 'left' ? 0 : 1 }
      : a)
    const sourcePos = store.getNodePosition(nodeId)
    const baseX = (sourcePos?.x ?? 200) + 360
    const baseY = (sourcePos?.y ?? 200) + (side === 'left' ? -180 : 180)
    const newTitle = `${fresh.title} · ${side === 'left' ? axis.leftLabel : axis.rightLabel}`

    // Create placeholder node first so the user sees the branch immediately
    const newId = store.addSketchNode({
      code:     '',
      library:  fresh.library,
      position: { x: baseX, y: baseY },
      title:    newTitle,
    })
    // Connect with a normal edge so it shows up in the history tree
    store.addEdge({ id: nanoid(6), source: nodeId, target: newId, sourceHandle: 'right', targetHandle: 'left' })
    try {
      const newCode = await generate({
        providerId: store.providerId,
        apiKey,
        modelId:    store.modelId,
        system:     getAxisScrubSystem(fresh.library),
        messages:   buildAxisScrubMessages(fresh.axesBaseline, polarAxes, fresh.library),
        maxTokens:  4096,
      })
      store.updateSketchCode(newId, newCode)
      // Carry the same axes over to the pinned node so the user can continue
      // exploring from there, snapped to this pole.
      store.setSketchAxes(newId, polarAxes, newCode)
    } catch (err) {
      console.error('Pin-pole generation error:', err)
    }
  }, [nodeId, store])

  if (!data) return null

  const axes = data.semanticAxes ?? []
  const isGenerating = data.axesGenerating === true

  // No axes yet → show "discover" affordance
  if (axes.length === 0) {
    return (
      <div className="nodrag nopan px-3 pb-2 pt-2 border-t border-border" onPointerDown={(e) => e.stopPropagation()}>
        <button
          onClick={discoverAxes}
          disabled={discoverLoading}
          className="w-full flex items-center justify-center gap-2 text-xs py-1.5 transition-colors"
          style={{
            color:        discoverLoading ? '#888' : '#a78bfa',
            background:   'rgba(140,73,223,0.08)',
            border:       '1px solid rgba(140,73,223,0.35)',
            borderRadius: 2,
            cursor:       discoverLoading ? 'wait' : 'pointer',
          }}
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-2xs uppercase tracking-wider text-text-muted flex items-center gap-1">
          <Icon name="discover-axes" size={10} />
          Semantic axes
        </span>
        <div className="flex items-center gap-2">
          {isGenerating && (
            <span className="text-2xs text-purple-300 flex items-center gap-1">
              <Icon name="loading" size={9} className="animate-spin" />
              re-prompting
            </span>
          )}
          <button
            onClick={discoverAxes}
            disabled={discoverLoading}
            className="text-2xs text-text-muted hover:text-text-primary nodrag"
            title="Re-discover axes from scratch"
          >
            <Icon name={discoverLoading ? 'loading' : 'refresh'} size={11} className={discoverLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* One row per axis */}
      {axes.map((a) => (
        <div key={a.id} className="space-y-0.5">
          <div className="flex items-center justify-between text-2xs">
            <button
              className="flex items-center gap-1 text-purple-300 hover:text-purple-200 nodrag truncate"
              onClick={() => pinPole(a, 'left')}
              title={`Pin "${a.leftLabel}" pole as a new branch sketch\n\n${a.leftPrompt}`}
              style={{ maxWidth: '40%' }}
            >
              <Icon name="open-new-node" size={10} style={{ opacity: 0.5 }} />
              <span className="truncate">{a.leftLabel}</span>
            </button>
            <button
              className="flex items-center gap-1 text-purple-300 hover:text-purple-200 nodrag truncate"
              onClick={() => pinPole(a, 'right')}
              title={`Pin "${a.rightLabel}" pole as a new branch sketch\n\n${a.rightPrompt}`}
              style={{ maxWidth: '40%' }}
            >
              <span className="truncate">{a.rightLabel}</span>
              <Icon name="open-new-node" size={10} style={{ opacity: 0.5 }} />
            </button>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={a.value}
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
