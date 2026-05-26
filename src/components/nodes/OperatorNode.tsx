import { memo, useState, useEffect, useRef, useCallback } from 'react'
import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/react'
import type { OperatorNodeData, OperatorType } from '../../utils/types'
import Icon from '../ui/Icon'
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

interface Meta { icon: string; label: string; color: string }

const OP_META: Record<OperatorType, Meta> = {
  modify:    { icon: 'modify',    label: 'Modify',    color: '#8C49DF' },
  duplicate: { icon: 'duplicate', label: 'Clone',     color: '#ca8a04' },
  merge:     { icon: 'merge',     label: 'Merge',     color: '#1d4ed8' },
  diff:      { icon: 'diff',      label: 'Diff',      color: '#047857' },
  extract:   { icon: 'extract',   label: 'Extract',   color: '#b45309' },
}

const S = {
  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', borderBottom: '1px solid #222', background: 'rgba(0,0,0,0.3)' } as React.CSSProperties,
  rfHandle:    { width: 10, height: 10, borderRadius: 1, border: 'none' } as React.CSSProperties,
  resizeHandle: { width: 10, height: 10, borderRadius: 2, border: '2px solid white', background: '#111' } as React.CSSProperties,
  paramBadge:  { fontSize: 10, padding: '1px 5px', borderRadius: 2, background: 'rgba(140,73,223,0.15)', color: '#a78bfa', fontFamily: 'var(--font-mono)' } as React.CSSProperties,
  deleteBtn:   { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, padding: 0, borderRadius: 2, border: '1px solid #2a2a2a', background: 'transparent', color: '#555', cursor: 'pointer', flexShrink: 0 } as React.CSSProperties,
  stream:      { background: '#0a0a14', maxHeight: 80, fontFamily: 'monospace' } as React.CSSProperties,
}

const OperatorNode = memo(function OperatorNode({ id, data, selected }: NodeProps<OperatorNodeType>) {
  const store = useStore()
  const meta  = OP_META[data.operatorType] ?? OP_META.modify
  const color = meta.color

  const [prompt,          setPrompt]          = useState(data.prompt ?? '')
  const [suggestions,     setSuggestions]     = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [streamingCode,   setStreamingCode]   = useState('')
  const autocompleteTimer = useRef<ReturnType<typeof setTimeout>>()
  const hasAutoFired      = useRef(false)
  const cascadeTimer      = useRef<ReturnType<typeof setTimeout>>()
  const prevSrc1Code      = useRef<string | null>(null)
  const prevSrc2Code      = useRef<string | null>(null)
  const handleGenerateRef = useRef<(promptOverride?: string) => Promise<void>>()

  const isDiff      = data.operatorType === 'diff'
  const isMerge     = data.operatorType === 'merge'
  const needsPrompt = data.operatorType === 'modify' || data.operatorType === 'extract'

  const src1Code = useStore((s) => {
    const n = s.nodes.find((node) => node.id === data.sourceNodeIds[0])
    return n?.type === 'sketch' ? (n.data.code as string) : ''
  })
  const src2Code = useStore((s) => {
    const nid = data.sourceNodeIds[1]
    if (!nid) return ''
    const n = s.nodes.find((node) => node.id === nid)
    return n?.type === 'sketch' ? (n.data.code as string) : ''
  })

  async function enrichSemanticLabels(generatedCode: string, targetId: string) {
    const src1Data  = store.getSketchNode(data.sourceNodeIds[0])
    const labelHint = data.prompt || src1Data?.sourcePrompt || ''
    if (!labelHint) return
    const varNames = extractParameters(generatedCode).map((p) => p.name)
    if (varNames.length === 0) return
    try {
      const raw      = await generateText({ providerId: store.providerId, apiKey: store.getActiveKey(), modelId: store.modelId, system: getSemanticLabelSystem(), messages: buildSemanticLabelMessages(varNames, labelHint, generatedCode) })
      const cleaned  = raw.replace(/```[a-z]*\n?/g, '').trim()
      const labelMap = JSON.parse(cleaned) as Record<string, string>
      store.updateSketchParameters(targetId, applySemanticLabels(extractParameters(generatedCode), labelMap))
    } catch {
      // Non-fatal: leave default labels
    }
  }

  const handleGenerate = useCallback(async (promptOverride?: string) => {
    const activePrompt = promptOverride ?? prompt
    const apiKey = store.getActiveKey()
    if (!apiKey) { alert('Please add an API key via "Connect Models" in the top bar.'); return }
    store.updateOperator(id, { isGenerating: true })
    setStreamingCode('')
    setShowSuggestions(false)

    try {
      const targetId = data.targetNodeId
      const src1Data = store.getSketchNode(data.sourceNodeIds[0])
      const src2Data = data.sourceNodeIds[1] ? store.getSketchNode(data.sourceNodeIds[1]) : undefined
      if (!src1Data) throw new Error('Source sketch not found')

      const library   = src1Data.library
      const genOpts   = { providerId: store.providerId, apiKey, modelId: store.modelId, maxTokens: 4096 }

      if (isDiff) {
        if (!src2Data) throw new Error('Second source sketch required for diff')
        const srcNode1 = store.nodes.find((n) => n.id === data.sourceNodeIds[0])
        const srcNode2 = store.nodes.find((n) => n.id === data.sourceNodeIds[1])
        const t1 = srcNode1?.type === 'sketch' ? (srcNode1.data.title as string) : 'Sketch A'
        const t2 = srcNode2?.type === 'sketch' ? (srcNode2.data.title as string) : 'Sketch B'
        const diffText = await generateText({ ...genOpts, system: getDiffSystem(), messages: buildDiffMessages(src1Data.code, src2Data.code, t1, t2) })
        store.updateOperator(id, { isGenerating: false, diffText })
        return
      }

      let msgs: { role: 'user' | 'assistant'; content: string }[]
      if (data.paramTransferLabel) {
        const paramName  = activePrompt.match(/variable: (\w+)/)?.[1] ?? 'param'
        const paramValue = parseFloat(activePrompt.match(/value: ([\d.]+)/)?.[1] ?? '1')
        msgs = buildParamTransferMessages(src1Data.code, paramName, data.paramTransferLabel ?? '', paramValue, '', library)
      } else if (isMerge) {
        if (!src2Data) throw new Error('Second source required for merge')
        msgs = buildMergeMessages(src1Data.code, src2Data.code)
      } else if (data.operatorType === 'extract') {
        msgs = buildExtractMessages(src1Data.code, activePrompt, library)
      } else {
        msgs = buildModifyMessages(src1Data.code, activePrompt, library)
      }

      const generatedCode = await generate({ ...genOpts, system: getSystemForOperator(data.operatorType, library), messages: msgs, onStream: (p) => setStreamingCode(p) })

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

  useEffect(() => {
    if (data.autoGenerate && !hasAutoFired.current && !data.isGenerating) {
      hasAutoFired.current = true
      handleGenerate(data.prompt)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isDiff && data.sourceNodeIds.length >= 2 && !data.diffText && !data.isGenerating) handleGenerate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  handleGenerateRef.current = handleGenerate

  // Cascade: re-run when a source sketch's code changes (debounced).
  useEffect(() => {
    if (prevSrc1Code.current === null) {
      prevSrc1Code.current = src1Code; prevSrc2Code.current = src2Code; return
    }
    const changed = src1Code !== prevSrc1Code.current || src2Code !== prevSrc2Code.current
    prevSrc1Code.current = src1Code; prevSrc2Code.current = src2Code
    if (!changed) return
    const targetData = data.targetNodeId ? store.getSketchNode(data.targetNodeId) : null
    const hasOutput  = (targetData?.code?.length ?? 0) > 0 || (isDiff && !!data.diffText)
    if (!hasOutput || data.isGenerating) return
    clearTimeout(cascadeTimer.current)
    cascadeTimer.current = setTimeout(() => handleGenerateRef.current?.(), 1500)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src1Code, src2Code])

  const fetchSuggestions = useCallback(async (value: string) => {
    const apiKey = store.getActiveKey()
    if (!value.trim() || !apiKey) return
    const sourceData = store.getSketchNode(data.sourceNodeIds[0])
    if (!sourceData) return
    try {
      const raw     = await generateText({ providerId: store.providerId, apiKey, modelId: store.modelId, system: 'Return exactly 3 creative autocomplete suggestions for this prompt as a JSON array of strings.', messages: buildAutocompleteMessages(value, sourceData.code) })
      const results = JSON.parse(raw.replace(/```[a-z]*\n?/g, '').trim()) as string[]
      setSuggestions(Array.isArray(results) ? results.slice(0, 3) : [])
      setShowSuggestions(true)
    } catch { /* non-fatal */ }
  }, [store, data.sourceNodeIds])

  function handlePromptChange(v: string) {
    setPrompt(v)
    store.updateOperator(id, { prompt: v })
    setShowSuggestions(false)
    clearTimeout(autocompleteTimer.current)
    if (v.length > 3) autocompleteTimer.current = setTimeout(() => fetchSuggestions(v), 700)
    else setSuggestions([])
  }

  return (
    <div style={{
      background: '#111',
      border: selected ? `1.5px solid ${color}` : '1px solid #2a2a2a',
      borderRadius: 2, minWidth: 240, height: '100%',
      boxShadow: selected ? `0 0 0 2px ${color}25, 0 4px 20px rgba(0,0,0,0.6)` : '0 4px 20px rgba(0,0,0,0.5)',
    }}>
      <NodeResizer isVisible={selected} minWidth={220} minHeight={100} color={color} handleStyle={S.resizeHandle} lineStyle={{ display: 'none' }} />
      <Handle type="target" position={Position.Left}  id="left"  style={{ ...S.rfHandle, background: color }} />
      <Handle type="source" position={Position.Right} id="right" style={{ ...S.rfHandle, background: color }} />

      <div style={S.header}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, flexShrink: 0, border: `2px solid ${color}`, borderRadius: 2 }}>
            <Icon name={meta.icon} size={10} />
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{meta.label}</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {data.isGenerating && <span style={{ fontSize: 11, color: '#606060', fontStyle: 'italic' }} className="animate-pulse">gen…</span>}
          {data.paramTransferLabel && <span style={S.paramBadge} title="Parameter transfer operation">⇄ {data.paramTransferLabel}</span>}
          <button style={S.deleteBtn} onClick={() => store.deleteNode(id)} title="Delete">
            <Icon name="delete" size={9} />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-2">
        {isDiff && data.diffText && <p className="text-xs text-text-secondary leading-relaxed">{data.diffText}</p>}
        {isDiff && !data.diffText && !data.isGenerating && (
          <button onClick={() => handleGenerate()} style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '6px 12px', border: `1px solid ${color}`, borderRadius: 2, background: color, color: '#fff', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            <Icon name="diff" size={14} /> Compare
          </button>
        )}

        {isMerge && (
          <p className="text-xs text-muted-foreground">
            Combining {data.sourceNodeIds.length} sketch{data.sourceNodeIds.length !== 1 ? 'es' : ''} into one
          </p>
        )}

        {needsPrompt && (
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => handlePromptChange(e.target.value)}
              placeholder={data.paramTransferLabel ? 'Transferring parameter…' : data.operatorType === 'extract' ? 'What to extract? e.g. "the colour gradient"' : 'Describe the modification…'}
              rows={3}
              className="nodrag flex min-h-[60px] w-full border border-border bg-input px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              style={{ lineHeight: '1.5', fontFamily: 'var(--font-sans)', fontSize: 12, borderRadius: 3 }}
              onFocus={() => setShowSuggestions(suggestions.length > 0)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 w-full top-full mt-1 overflow-hidden shadow-popup" style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 3 }}>
                {suggestions.map((s, i) => (
                  <button key={i} className="w-full text-left px-2 py-1.5 text-xs text-text-secondary hover:bg-surface3 hover:text-text-primary"
                    onMouseDown={(e) => { e.preventDefault(); setPrompt(s); store.updateOperator(id, { prompt: s }); setShowSuggestions(false) }}
                  >{s}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {streamingCode && (
          <pre className="text-2xs text-text-muted overflow-hidden p-1.5" style={S.stream}>{streamingCode.slice(-300)}</pre>
        )}

        {(needsPrompt || isMerge) && !data.isGenerating && (
          <button onClick={() => handleGenerate()} disabled={needsPrompt && !prompt.trim()}
            style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '6px 12px', border: `1px solid ${color}`, borderRadius: 2, background: color, color: '#fff', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: needsPrompt && !prompt.trim() ? 0.4 : 1 }}
          >
            <Icon name="generate" size={14} />
            {isMerge ? 'Blend Sketches' : 'Generate'}
          </button>
        )}
        {data.isGenerating && (
          <div className="flex items-center justify-center gap-2 py-1.5">
            <Icon name="modify" size={14} className="animate-pulse" style={{ color }} />
            <span className="text-xs text-muted-foreground">Generating…</span>
          </div>
        )}
      </div>
    </div>
  )
})

export default OperatorNode
