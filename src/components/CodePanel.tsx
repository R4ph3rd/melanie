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

  // Variables flowing in from upstream sketches' output() channels — the data
  // this sketch can read. Declare a matching top-level var to consume one.
  const inputSources = useMemo(() =>
    edges
      .filter((e) => e.target === nodeId && e.data?.kind === 'signal' && !e.data.bindingId)
      .map((e) => e.source)
      .filter((src): src is string => !!src && nodes.find((n) => n.id === src)?.type === 'sketch')
  , [edges, nodes, nodeId])

  const inVars = useMemo(() => {
    const out: { source: string; channel: string }[] = []
    for (const src of inputSources) {
      const code = (nodes.find((n) => n.id === src)?.data as { code?: string } | undefined)?.code ?? ''
      const names = new Set([...extractDynamicOutputs(code), ...Object.keys(getNodeSignals(src))])
      for (const channel of names) out.push({ source: src, channel })
    }
    return out
  }, [inputSources, nodes])

  // Re-render a few times a second so the displayed live values update.
  const [, force] = useState(0)
  useEffect(() => {
    if (inVars.length === 0) return
    const t = setInterval(() => force((n) => n + 1), 150)
    return () => clearInterval(t)
  }, [inVars.length])

  useEffect(() => {
    if (data?.code !== undefined) { setLocalCode(data.code); setDirty(false) }
  }, [nodeId])

  const handleChange = useCallback((value: string) => { setLocalCode(value); setDirty(true) }, [])

  // Ref so the CodeMirror keybinding calls the latest applyCode without recreating the extension each keystroke.
  const applyCodeRef = useRef<() => void>()

  function applyCode() {
    updateCode(nodeId, localCode)   // bumps generationKey → preview remounts
    setDirty(false)
  }

  applyCodeRef.current = applyCode

  // Insert a top-level declaration for an incoming variable so the sketch can read it.
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

      {inVars.length > 0 && (
        <div style={{ padding: '6px 10px', borderBottom: '1px solid #1a1a1a', background: '#0a0a0f' }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
            Signals in · click to declare
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {inVars.map(({ source, channel }) => {
              const declared = new RegExp(`(?:let|var|const)\\s+${channel}\\b`).test(localCode)
              return (
                <button key={`${source}:${channel}`} onClick={() => consumeVar(channel)} title={declared ? 'already declared' : `insert "let ${channel} = 0"`}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 7px', borderRadius: 3, cursor: 'pointer',
                    border: `1px solid ${declared ? '#0ea5e9' : '#243b4a'}`, background: declared ? 'rgba(14,165,233,0.12)' : '#0d141a' }}>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: declared ? '#7dd3fc' : '#5f7a8a' }}>{channel}</span>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#0ea5e9', fontVariantNumeric: 'tabular-nums' }}>
                    {getSignalValue(source, channel).toFixed(2)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

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
