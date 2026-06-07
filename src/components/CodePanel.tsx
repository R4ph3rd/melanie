import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { vscodeDark } from '@uiw/codemirror-theme-vscode'
import { keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import Icon from './ui/Icon'
import { useStore } from '../store/store'
import { Badge } from './ui/badge'

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
  const [localCode, setLocalCode] = useState(data?.code ?? '')
  const [dirty,     setDirty]     = useState(false)

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
