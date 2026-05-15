/**
 * OperatorNode — generates code via the multi-provider API.
 *
 * After code generation it fires an async semantic-label enrichment call
 * so parameter sliders show human-readable labels instead of variable names.
 *
 * When data.autoGenerate === true the node fires generation on mount
 * (used for param-transfer ops created programmatically).
 */
import { memo, useState, useEffect, useRef, useCallback } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faMagicWandSparkles, faClone, faCodeMerge, faCodeBranch,
  faScissors, faXmark, faBolt,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type { OperatorNodeData, OperatorType } from '../../utils/types'
import { useStore } from '../../store/store'
import { generate, generateText } from '../../api/providers'
import {
  getSystemForOperator,
  buildModifyMessages,
  buildMergeMessages,
  buildDiffMessages,
  buildExtractMessages,
  buildAutocompleteMessages,
  getDiffSystem,
  getSemanticLabelSystem,
  buildSemanticLabelMessages,
  buildParamTransferMessages,
} from '../../prompts'
import { extractParameters, applySemanticLabels } from '../../utils/codeUtils'

type OperatorNodeType = Node<OperatorNodeData, 'operator'>

// ─── Visual meta per op type ──────────────────────────────────────────────────

interface Meta { icon: IconDefinition; label: string; color: string }

const OP_META: Record<OperatorType, Meta> = {
  modify:    { icon: faMagicWandSparkles, label: 'Modify',    color: '#7c3aed' },
  duplicate: { icon: faClone,             label: 'Duplicate', color: '#4b5563' },
  merge:     { icon: faCodeMerge,         label: 'Merge',     color: '#1d4ed8' },
  diff:      { icon: faCodeBranch,        label: 'Diff',      color: '#047857' },
  extract:   { icon: faScissors,          label: 'Extract',   color: '#b45309' },
}

// ─── Component ────────────────────────────────────────────────────────────────

const OperatorNode = memo(function OperatorNode({ id, data, selected }: NodeProps<OperatorNodeType>) {
  const store    = useStore()
  const meta     = OP_META[data.operatorType] ?? OP_META.modify

  const [prompt,          setPrompt]          = useState(data.prompt ?? '')
  const [suggestions,     setSuggestions]     = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [streamingCode,   setStreamingCode]   = useState('')
  const autocompleteTimer = useRef<ReturnType<typeof setTimeout>>()
  const hasAutoFired      = useRef(false)

  const isDiff      = data.operatorType === 'diff'
  const isMerge     = data.operatorType === 'merge'
  const needsPrompt = data.operatorType === 'modify' || data.operatorType === 'extract'

  // ── Semantic label enrichment ──────────────────────────────────────────────
  async function enrichSemanticLabels(generatedCode: string, targetId: string) {
    const src1Data  = store.getSketchNode(data.sourceNodeIds[0])
    const labelHint = data.prompt || src1Data?.sourcePrompt || ''
    if (!labelHint) return

    const varNames = extractParameters(generatedCode).map((p) => p.name)
    if (varNames.length === 0) return

    try {
      const raw = await generateText({
        providerId: store.providerId,
        apiKey:     store.getActiveKey(),
        modelId:    store.modelId,
        system:     getSemanticLabelSystem(),
        messages:   buildSemanticLabelMessages(varNames, labelHint, generatedCode),
      })
      // Strip potential markdown fences
      const cleaned = raw.replace(/```[a-z]*\n?/g, '').trim()
      const labelMap = JSON.parse(cleaned) as Record<string, string>
      const enriched = applySemanticLabels(extractParameters(generatedCode), labelMap)
      store.updateSketchParameters(targetId, enriched)
    } catch {
      // Non-fatal: leave default labels
    }
  }

  // ── Core generation ────────────────────────────────────────────────────────
  // Accepts an optional promptOverride so suggestion clicks can pass the chosen
  // text directly without waiting for a state update to flush.
  const handleGenerate = useCallback(async (promptOverride?: string) => {
    const activePrompt = promptOverride ?? prompt
    const apiKey = store.getActiveKey()
    if (!apiKey) {
      alert('Please add an API key via "Connect Models" in the top bar.')
      return
    }
    store.updateOperator(id, { isGenerating: true })
    setStreamingCode('')
    setShowSuggestions(false)

    try {
      const targetId  = data.targetNodeId
      const src1Data  = store.getSketchNode(data.sourceNodeIds[0])
      const src2Data  = data.sourceNodeIds[1] ? store.getSketchNode(data.sourceNodeIds[1]) : undefined

      if (!src1Data) throw new Error('Source sketch not found')

      const library      = src1Data.library
      const systemPrompt = getSystemForOperator(data.operatorType, library)
      const genOpts      = {
        providerId: store.providerId,
        apiKey,
        modelId:    store.modelId,
        maxTokens:  4096,
      }

      // ── Diff: text description only ──
      if (isDiff) {
        if (!src2Data) throw new Error('Second source sketch required for diff')
        const srcNode1 = store.nodes.find((n) => n.id === data.sourceNodeIds[0])
        const srcNode2 = store.nodes.find((n) => n.id === data.sourceNodeIds[1])
        const t1 = srcNode1?.type === 'sketch' ? (srcNode1.data.title as string) : 'Sketch A'
        const t2 = srcNode2?.type === 'sketch' ? (srcNode2.data.title as string) : 'Sketch B'
        const msgs = buildDiffMessages(src1Data.code, src2Data.code, t1, t2)
        const diffText = await generateText({ ...genOpts, system: getDiffSystem(), messages: msgs })
        store.updateOperator(id, { isGenerating: false, diffText })
        return
      }

      // ── Param-transfer: specialised messages ──
      let msgs: { role: 'user' | 'assistant'; content: string }[]
      if (data.paramTransferLabel) {
        const paramName  = activePrompt.match(/variable: (\w+)/)?.[1] ?? 'param'
        const paramValue = parseFloat(activePrompt.match(/value: ([\d.]+)/)?.[1] ?? '1')
        msgs = buildParamTransferMessages(
          src1Data.code, paramName, data.paramTransferLabel ?? '', paramValue,
          '', library,
        )
      } else if (isMerge) {
        if (!src2Data) throw new Error('Second source required for merge')
        msgs = buildMergeMessages(src1Data.code, src2Data.code)
      } else if (data.operatorType === 'extract') {
        msgs = buildExtractMessages(src1Data.code, activePrompt, library)
      } else {
        msgs = buildModifyMessages(src1Data.code, activePrompt, library)
      }

      const generatedCode = await generate({
        ...genOpts,
        system:   systemPrompt,
        messages: msgs,
        onStream: (partial) => setStreamingCode(partial),
      })

      if (targetId) {
        store.updateSketchCode(targetId, generatedCode)
        store.updateOperator(id, { isGenerating: false, prompt: activePrompt, autoGenerate: false })
        setStreamingCode('')
        enrichSemanticLabels(generatedCode, targetId)
      }
    } catch (err) {
      console.error('Generation error:', err)
      store.updateOperator(id, { isGenerating: false })
      setStreamingCode('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, data, prompt, store])

  // ── Auto-generate on mount when flagged ───────────────────────────────────
  useEffect(() => {
    if (data.autoGenerate && !hasAutoFired.current && !data.isGenerating) {
      hasAutoFired.current = true
      handleGenerate(data.prompt)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Diff auto-fire on mount when both sources present ─────────────────────
  useEffect(() => {
    if (isDiff && data.sourceNodeIds.length >= 2 && !data.diffText && !data.isGenerating) {
      handleGenerate()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Autocomplete ──────────────────────────────────────────────────────────
  const fetchSuggestions = useCallback(
    async (value: string) => {
      const apiKey = store.getActiveKey()
      if (!value.trim() || !apiKey) return
      const sourceData = store.getSketchNode(data.sourceNodeIds[0])
      if (!sourceData) return
      const msgs = buildAutocompleteMessages(value, sourceData.code)
      try {
        const raw = await generateText({
          providerId: store.providerId,
          apiKey,
          modelId:    store.modelId,
          system:     'Return exactly 3 creative autocomplete suggestions for this prompt as a JSON array of strings.',
          messages:   msgs,
        })
        const cleaned = raw.replace(/```[a-z]*\n?/g, '').trim()
        const results = JSON.parse(cleaned) as string[]
        setSuggestions(Array.isArray(results) ? results.slice(0, 3) : [])
        setShowSuggestions(true)
      } catch { /* non-fatal */ }
    },
    [store, data.sourceNodeIds],
  )

  function handlePromptChange(v: string) {
    setPrompt(v)
    store.updateOperator(id, { prompt: v })
    // Always close the dropdown immediately when the user types — it reopens
    // automatically after a 700ms pause via the debounced fetchSuggestions.
    setShowSuggestions(false)
    clearTimeout(autocompleteTimer.current)
    if (v.length > 3) {
      autocompleteTimer.current = setTimeout(() => fetchSuggestions(v), 700)
    } else {
      setSuggestions([])
    }
  }

  const borderColor = meta.color

  return (
    <div
      style={{
        background: '#131320',
        border: selected ? `1.5px solid ${borderColor}` : '1px solid #2a2a3a',
        borderRadius: 8,
        minWidth: 240,
        maxWidth: 280,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}
    >
      <Handle type="target" position={Position.Left}  id="left"  style={{ background: borderColor, width: 10, height: 10 }} />
      <Handle type="source" position={Position.Right} id="right" style={{ background: borderColor, width: 10, height: 10 }} />

      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 rounded-t-lg"
        style={{ borderBottom: '1px solid #2a2a3a', background: 'rgba(0,0,0,0.3)' }}
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: borderColor }}>
          <FontAwesomeIcon icon={meta.icon} className="w-3.5" />
          <span>{meta.label}</span>
        </span>
        <div className="flex items-center gap-1.5">
          {data.isGenerating && (
            <span className="text-xs text-text-muted animate-pulse">generating…</span>
          )}
          {data.paramTransferLabel && (
            <span
              className="text-2xs px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}
              title="Parameter transfer operation"
            >
              ⇄ {data.paramTransferLabel}
            </span>
          )}
          <button
            onClick={() => store.deleteNode(id)}
            className="text-text-muted hover:text-error text-xs w-5 h-5 flex items-center justify-center"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-2">
        {/* Diff result */}
        {isDiff && data.diffText && (
          <p className="text-xs text-text-secondary leading-relaxed">{data.diffText}</p>
        )}
        {isDiff && !data.diffText && !data.isGenerating && (
          <button
            onClick={() => handleGenerate()}
            className="w-full py-1.5 rounded text-sm font-medium flex items-center justify-center gap-2"
            style={{ background: borderColor, color: '#fff' }}
          >
            <FontAwesomeIcon icon={faCodeBranch} /> Compare
          </button>
        )}

        {/* Merge info */}
        {isMerge && (
          <p className="text-xs text-text-muted">
            Combining {data.sourceNodeIds.length} sketch{data.sourceNodeIds.length !== 1 ? 'es' : ''} into one
          </p>
        )}

        {/* Prompt textarea (modify / extract) */}
        {needsPrompt && (
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => handlePromptChange(e.target.value)}
              placeholder={
                data.paramTransferLabel
                  ? 'Transferring parameter…'
                  : data.operatorType === 'extract'
                  ? 'What to extract? e.g. "the colour gradient"'
                  : 'Describe the modification…'
              }
              rows={3}
              className="w-full resize-none rounded px-2 py-1.5 text-xs text-text-primary placeholder-text-muted outline-none nodrag"
              style={{
                background:  '#0d0d1a',
                border:      '1px solid #333',
                lineHeight:  '1.5',
                fontFamily:  'Inter, sans-serif',
              }}
              onFocus={() => setShowSuggestions(suggestions.length > 0)}
              onBlur={() => {
                // Close after a short delay — gives onMouseDown on suggestion
                // buttons time to fire before focus moves away.
                setTimeout(() => setShowSuggestions(false), 150)
              }}
            />
            {/* Autocomplete dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                className="absolute z-50 w-full top-full mt-1 rounded overflow-hidden shadow-popup"
                style={{ background: '#1a1a2e', border: '1px solid #333' }}
              >
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    className="w-full text-left px-2 py-1.5 text-xs text-text-secondary hover:bg-surface3 hover:text-text-primary"
                    onMouseDown={(e) => {
                      // preventDefault keeps focus on textarea so onBlur doesn't
                      // race with this click.
                      e.preventDefault()
                      setPrompt(s)
                      store.updateOperator(id, { prompt: s })
                      setShowSuggestions(false)
                      // Fire generation immediately with the chosen suggestion text.
                      handleGenerate(s)
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Streaming preview */}
        {streamingCode && (
          <pre
            className="text-2xs text-text-muted overflow-hidden rounded p-1.5"
            style={{ background: '#0a0a14', maxHeight: 80, fontFamily: 'monospace' }}
          >
            {streamingCode.slice(-300)}
          </pre>
        )}

        {/* Generate / loading */}
        {(needsPrompt || isMerge) && !data.isGenerating && (
          <button
            onClick={() => handleGenerate()}
            disabled={needsPrompt && !prompt.trim()}
            className="w-full py-1.5 rounded text-sm font-medium transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: borderColor, color: '#fff' }}
          >
            <FontAwesomeIcon icon={faBolt} />
            {isMerge ? 'Blend Sketches' : 'Generate'}
          </button>
        )}
        {data.isGenerating && (
          <div className="flex items-center justify-center gap-2 py-1.5">
            <FontAwesomeIcon
              icon={faMagicWandSparkles}
              className="animate-pulse"
              style={{ color: borderColor }}
            />
            <span className="text-xs text-text-muted">Generating…</span>
          </div>
        )}
      </div>
    </div>
  )
})

export default OperatorNode
