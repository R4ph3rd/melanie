import { memo, useState, useEffect, useRef, useCallback } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { OperatorNodeData } from '../../utils/types'
import { useStore } from '../../store/store'
import {
  getSystemForOperator,
  buildModifyMessages,
  buildMergeMessages,
  buildDiffMessages,
  buildExtractMessages,
  buildAutocompleteMessages,
  getDiffSystem,
} from '../../prompts'
import { generateCode, getDiffText, getAutocompleteSuggestions } from '../../api/claude'
import { operatorMeta } from '../../design-system'

type OperatorNodeType = Node<OperatorNodeData, 'operator'>

const OperatorNode = memo(function OperatorNode({ id, data, selected }: NodeProps<OperatorNodeType>) {
  const store       = useStore()
  const [prompt, setPrompt] = useState(data.prompt ?? '')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [streamingCode, setStreamingCode] = useState('')
  const autocompleteTimer = useRef<ReturnType<typeof setTimeout>>()
  const meta = operatorMeta[data.operatorType] ?? operatorMeta.modify

  // Kick off diff automatically when node is created with two sources
  useEffect(() => {
    if (
      data.operatorType === 'diff' &&
      data.sourceNodeIds.length >= 2 &&
      !data.diffText &&
      !data.isGenerating
    ) {
      handleGenerate()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchSuggestions = useCallback(
    async (value: string) => {
      if (!value.trim() || !store.apiKey) return
      const sourceData = store.getSketchNode(data.sourceNodeIds[0])
      if (!sourceData) return
      const msgs = buildAutocompleteMessages(value, sourceData.code)
      const results = await getAutocompleteSuggestions(store.apiKey, store.model, msgs)
      setSuggestions(results)
      setShowSuggestions(results.length > 0)
    },
    [store, data.sourceNodeIds]
  )

  function handlePromptChange(v: string) {
    setPrompt(v)
    store.updateOperator(id, { prompt: v })
    clearTimeout(autocompleteTimer.current)
    if (v.length > 3) {
      autocompleteTimer.current = setTimeout(() => fetchSuggestions(v), 600)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  async function handleGenerate() {
    if (!store.apiKey) {
      alert('Please enter your Anthropic API key in the top bar.')
      return
    }
    store.updateOperator(id, { isGenerating: true })
    setStreamingCode('')
    setShowSuggestions(false)

    try {
      const targetId = data.targetNodeId
      const src1Data = store.getSketchNode(data.sourceNodeIds[0])
      const src2Data = data.sourceNodeIds[1] ? store.getSketchNode(data.sourceNodeIds[1]) : undefined

      if (!src1Data) throw new Error('Source sketch not found')

      const library = src1Data.library
      const systemPrompt = getSystemForOperator(data.operatorType, library)

      if (data.operatorType === 'diff') {
        if (!src2Data) throw new Error('Second source sketch required for diff')
        const src1Node = store.nodes.find(n => n.id === data.sourceNodeIds[0])
        const src2Node = store.nodes.find(n => n.id === data.sourceNodeIds[1])
        const t1 = src1Node?.type === 'sketch' ? src1Node.data.title as string : 'Sketch A'
        const t2 = src2Node?.type === 'sketch' ? src2Node.data.title as string : 'Sketch B'
        const msgs = buildDiffMessages(src1Data.code, src2Data.code, t1, t2)
        const diffText = await getDiffText(store.apiKey, store.model, getDiffSystem(), msgs)
        store.updateOperator(id, { isGenerating: false, diffText })
        return
      }

      let msgs: { role: 'user' | 'assistant'; content: string }[]
      if (data.operatorType === 'merge') {
        if (!src2Data) throw new Error('Second source sketch required for merge')
        msgs = buildMergeMessages(src1Data.code, src2Data.code)
      } else if (data.operatorType === 'extract') {
        msgs = buildExtractMessages(src1Data.code, prompt, library)
      } else {
        msgs = buildModifyMessages(src1Data.code, prompt, library)
      }

      const generatedCode = await generateCode(
        store.apiKey,
        store.model,
        systemPrompt,
        msgs,
        (partial) => setStreamingCode(partial),
      )

      if (targetId) {
        store.updateSketchCode(targetId, generatedCode)
        store.updateOperator(id, { isGenerating: false, prompt })
      }
      setStreamingCode('')
    } catch (err) {
      console.error('Generation error:', err)
      store.updateOperator(id, { isGenerating: false })
      setStreamingCode('')
    }
  }

  const borderColor = meta.color
  const isDiff = data.operatorType === 'diff'
  const needsPrompt = data.operatorType === 'modify' || data.operatorType === 'extract'
  const isMerge = data.operatorType === 'merge'

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
        style={{ borderBottom: `1px solid #2a2a3a`, background: 'rgba(0,0,0,0.3)' }}
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: borderColor }}>
          <span>{meta.icon}</span>
          <span>{meta.label}</span>
        </span>
        {data.isGenerating && (
          <span className="text-xs text-text-muted animate-pulse">generating…</span>
        )}
        <button
          onClick={() => store.deleteNode(id)}
          className="text-text-muted hover:text-error text-xs w-5 h-5 flex items-center justify-center"
        >
          ✕
        </button>
      </div>

      <div className="p-3 space-y-2">
        {/* Diff result */}
        {isDiff && data.diffText && (
          <p className="text-xs text-text-secondary leading-relaxed">{data.diffText}</p>
        )}
        {isDiff && !data.diffText && !data.isGenerating && (
          <button
            onClick={handleGenerate}
            className="w-full py-1.5 rounded text-sm font-medium"
            style={{ background: borderColor, color: '#fff' }}
          >
            Compare
          </button>
        )}

        {/* Merge info */}
        {isMerge && !data.isGenerating && (
          <>
            <p className="text-xs text-text-muted">
              Merging {data.sourceNodeIds.length} sketch{data.sourceNodeIds.length !== 1 ? 'es' : ''} semantically
            </p>
            {!data.prompt && (
              <button
                onClick={handleGenerate}
                className="w-full py-1.5 rounded text-sm font-medium"
                style={{ background: borderColor, color: '#fff' }}
              >
                Merge
              </button>
            )}
          </>
        )}

        {/* Prompt input for modify / extract */}
        {needsPrompt && (
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => handlePromptChange(e.target.value)}
              placeholder={
                data.operatorType === 'extract'
                  ? 'What to extract? e.g. "the color gradient"'
                  : 'Describe the modification…'
              }
              rows={3}
              className="w-full resize-none rounded px-2 py-1.5 text-xs text-text-primary placeholder-text-muted outline-none"
              style={{
                background: '#0d0d1a',
                border: '1px solid #333',
                fontFamily: 'Inter, sans-serif',
                lineHeight: '1.5',
              }}
              onFocus={() => setShowSuggestions(suggestions.length > 0)}
            />
            {/* Autocomplete suggestions */}
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
                      e.preventDefault()
                      setPrompt(s)
                      store.updateOperator(id, { prompt: s })
                      setShowSuggestions(false)
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

        {/* Generate button for modify / extract / merge */}
        {(needsPrompt || isMerge) && !data.isGenerating && (
          <button
            onClick={handleGenerate}
            disabled={needsPrompt && !prompt.trim()}
            className="w-full py-1.5 rounded text-sm font-medium transition-opacity disabled:opacity-40"
            style={{ background: borderColor, color: '#fff' }}
          >
            Generate
          </button>
        )}
        {data.isGenerating && (
          <div className="flex items-center justify-center gap-2 py-1.5">
            <span className="animate-spin-slow text-lg" style={{ color: borderColor }}>⊙</span>
            <span className="text-xs text-text-muted">Generating…</span>
          </div>
        )}
      </div>
    </div>
  )
})

export default OperatorNode
