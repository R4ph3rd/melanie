import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { vscodeDark } from '@uiw/codemirror-theme-vscode'
import { keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import Icon from './ui/Icon'
import { useStore } from '../store/store'
import { Badge } from './ui/badge'
import { getSignalValue, getNodeSignals } from '../store/signals'
import { extractDynamicOutputs } from '../utils/codeUtils'

interface Props { nodeId: string; onClose: () => void }

const S = {
  root:      { background: '#0c0c0c', borderRight: '1px solid #1e1e1e' } as React.CSSProperties,
  header:    { padding: '5px 10px', borderBottom: '1px solid #1e1e1e', background: '#111' } as React.CSSProperties,
  iconBadge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, border: '2px solid #444', borderRadius: 2, fontFamily: 'var(--font-mono)', fontSize: 10, color: '#606060' } as React.CSSProperties,
  closeBtn:  { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, border: '1px solid #2a2a2a', borderRadius: 2, background: 'transparent', color: '#555', cursor: 'pointer' } as React.CSSProperties,
}

export default function CodePanel({ nodeId, onClose }: Props) {
  const data       = useStore((s) => s.getSketchNode(nodeId))
  const updateCode = useStore((s) => s.updateSketchCode)
  const edges      = useStore((s) => s.edges)
  const nodes      = useStore((s) => s.nodes)
  const [localCode, setLocalCode] = useState(data?.code ?? '')
  const [dirty,     setDirty]     = useState(false)

  // Sketch→sketch signal sources connected to this node (passthrough edges, no bindingId).
  const inputSources = useMemo(() =>
    edges
      .filter((e) => e.target === nodeId && e.data?.kind === 'signal' && !e.data.bindingId)
      .map((e) => e.source)
      .filter((src): src is string => !!src && nodes.find((n) => n.id === src)?.type === 'sketch')
  , [edges, nodes, nodeId])

  // Per-source metadata: sketch title + which output() channels it exposes.
  const sourceMeta = useMemo(() =>
    inputSources.map((srcId) => {
      const node    = nodes.find((n) => n.id === srcId)
      const title   = (node?.data as { title?: string } | undefined)?.title ?? srcId
      const code    = (node?.data as { code?: string } | undefined)?.code ?? ''
      const channels = [...new Set([...extractDynamicOutputs(code), ...Object.keys(getNodeSignals(srcId))])]
      return { srcId, title, channels }
    })
  , [inputSources, nodes])

  // Collapse state per source (default expanded).
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const toggleCollapsed = useCallback((srcId: string) => {
    setCollapsed((c) => ({ ...c, [srcId]: !c[srcId] }))
  }, [])

  // Re-render a few times a second so the displayed live values update.
  const [, force] = useState(0)
  useEffect(() => {
    if (inputSources.length === 0) return
    const t = setInterval(() => force((n) => n + 1), 150)
    return () => clearInterval(t)
  }, [inputSources.length])

  useEffect(() => {
    if (data?.code !== undefined) { setLocalCode(data.code); setDirty(false) }
  }, [nodeId])

  const handleChange = useCallback((value: string) => { setLocalCode(value); setDirty(true) }, [])

  const applyCodeRef = useRef<() => void>()

  function applyCode() {
    updateCode(nodeId, localCode)
    setDirty(false)
  }

  applyCodeRef.current = applyCode

  const consumeVar = useCallback((name: string) => {
    if (new RegExp(`(?:let|var|const)\\s+${name}\\b`).test(localCode)) return
    setLocalCode((c) => `let ${name} = 0; // ← signal in\n${c}`)
    setDirty(true)
  }, [localCode])

  const extensions = useMemo(() => [
    javascript({ jsx: false }),
    Prec.highest(keymap.of([{ key: 'Ctrl-Enter', mac: 'Cmd-Enter', run: () => { applyCodeRef.current?.(); return true } }])),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [])

  if (!data) return null

  return (
    <div className="flex flex-col h-full" style={S.root}>
      <div className="flex items-center justify-between flex-shrink-0" style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={S.iconBadge}>{'</>'}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#d0d0d0' }}>{data.title}</span>
          {dirty && <Badge variant="outline" className="text-warning border-warning/30 text-[10px] rounded-sm">unsaved</Badge>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={applyCode} title="Apply changes (Ctrl+Enter)"
            style={{ padding: '3px 10px', border: dirty ? '1px solid #8C49DF' : '1px solid #333', borderRadius: 2, background: dirty ? 'rgba(140,73,223,0.15)' : 'transparent', color: dirty ? '#8C49DF' : '#555', fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.1s' }}
          >Apply ↵</button>
          <button onClick={onClose} style={S.closeBtn}>
            <Icon name="close" size={12} />
          </button>
        </div>
      </div>

      <div className="px-3 py-1.5 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: '1px solid #1a1a1a' }}>
        <Badge variant={data.library === 'p5js' ? 'p5' : 'threejs'}>
          {data.library === 'p5js' ? 'p5.js' : 'three.js'}
        </Badge>
        <span className="text-2xs text-muted-foreground font-mono">{localCode.split('\n').length} lines</span>
        <span className="text-2xs text-muted-foreground">Ctrl+Enter to apply</span>
      </div>

      {/* Signal-in tray — always visible when a sketch sig-out is connected */}
      {sourceMeta.map(({ srcId, title, channels }) => {
        const isCollapsed = collapsed[srcId] ?? false
        return (
          <div key={srcId} style={{ borderBottom: '1px solid #1a1a1a', background: '#080810' }}>
            {/* Collapsible header */}
            <button
              onClick={() => toggleCollapsed(srcId)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '5px 10px',
                background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ fontSize: 9, color: '#555', lineHeight: 1, userSelect: 'none' }}>
                {isCollapsed ? '▶' : '▼'}
              </span>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#0ea5e9' }}>
                {channels.length} dynamic variable{channels.length !== 1 ? 's' : ''} from{' '}
              </span>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#7dd3fc', fontWeight: 600 }}>
                {title}
              </span>
            </button>

            {/* Variable pills — hidden when collapsed or no channels */}
            {!isCollapsed && channels.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '2px 10px 8px' }}>
                {channels.map((channel) => {
                  const declared = new RegExp(`(?:let|var|const)\\s+${channel}\\b`).test(localCode)
                  return (
                    <button key={channel} onClick={() => consumeVar(channel)}
                      title={declared ? 'already declared' : `insert "let ${channel} = 0"`}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 7px', borderRadius: 3, cursor: 'pointer',
                        border: `1px solid ${declared ? '#0ea5e9' : '#1c3040'}`,
                        background: declared ? 'rgba(14,165,233,0.12)' : '#0c1820' }}>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: declared ? '#7dd3fc' : '#4a6a7a' }}>{channel}</span>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#0ea5e9', fontVariantNumeric: 'tabular-nums' }}>
                        {getSignalValue(srcId, channel).toFixed(2)}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {!isCollapsed && channels.length === 0 && (
              <p style={{ margin: 0, padding: '0 10px 8px', fontSize: 10, fontFamily: 'var(--font-mono)', color: '#333' }}>
                No output() calls in draw loop yet
              </p>
            )}
          </div>
        )
      })}

      <div className="flex-1 overflow-auto">
        <CodeMirror
          value={localCode}
          onChange={handleChange}
          extensions={extensions}
          theme={vscodeDark}
          style={{ height: '100%', fontSize: 12 }}
          basicSetup={{ lineNumbers: true, foldGutter: true, autocompletion: true, highlightActiveLine: true }}
        />
      </div>
    </div>
  )
}
