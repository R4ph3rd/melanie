import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { vscodeDark } from '@uiw/codemirror-theme-vscode'
import { keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { useStore } from '../store/store'

interface Props {
  nodeId: string
  onClose: () => void
}

export default function CodePanel({ nodeId, onClose }: Props) {
  const data         = useStore((s) => s.getSketchNode(nodeId))
  const updateCode   = useStore((s) => s.updateSketchCode)
  const reloadSketch = useStore((s) => s.reloadSketch)
  const [localCode, setLocalCode] = useState(data?.code ?? '')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (data?.code !== undefined) {
      setLocalCode(data.code)
      setDirty(false)
    }
  }, [nodeId]) // reset when switching nodes

  const handleChange = useCallback((value: string) => {
    setLocalCode(value)
    setDirty(true)
  }, [])

  // Use a ref so the CodeMirror keybinding always calls the latest applyCode
  // without needing to recreate the extension on every keystroke.
  const applyCodeRef = useRef<() => void>()

  function applyCode() {
    updateCode(nodeId, localCode)
    reloadSketch(nodeId)
    setDirty(false)
  }

  // Keep ref in sync every render
  applyCodeRef.current = applyCode

  // Stable extension: Ctrl+Enter / Cmd+Enter triggers apply from inside the editor.
  // Created once (empty deps) — freshness is handled via the ref above.
  const extensions = useMemo(() => [
    javascript({ jsx: false }),
    Prec.highest(keymap.of([{
      key: 'Ctrl-Enter',
      mac: 'Cmd-Enter',
      run: () => { applyCodeRef.current?.(); return true },
    }])),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [])

  if (!data) return null

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: '#0e0e14', borderRight: '1px solid #2a2a3a' }}
    >
      {/* Panel header */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid #2a2a3a', background: '#111118' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-text-muted text-xs font-mono">{'</>'}</span>
          <span className="text-sm font-medium text-text-primary">{data.title}</span>
          {dirty && (
            <span className="text-2xs px-1.5 py-0.5 rounded bg-surface3 text-warning">
              unsaved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={applyCode}
            className="px-3 py-1 rounded text-xs font-medium"
            style={{
              background: dirty ? '#7c3aed' : 'transparent',
              color:      dirty ? '#fff'    : '#555',
              border:     dirty ? 'none'    : '1px solid #333',
            }}
            title="Apply changes (Ctrl+Enter)"
          >
            Apply ↵
          </button>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-sm w-6 h-6 flex items-center justify-center rounded hover:bg-surface3"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Library badge */}
      <div className="px-4 py-1.5 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: '1px solid #1e1e2a' }}>
        <span
          className="text-2xs px-2 py-0.5 rounded"
          style={{
            background: data.library === 'p5js' ? '#1a2a1a' : '#1a1a2e',
            color: data.library === 'p5js' ? '#4ade80' : '#60a5fa',
          }}
        >
          {data.library === 'p5js' ? 'p5.js' : 'three.js'}
        </span>
        <span className="text-2xs text-text-muted font-mono">
          {localCode.split('\n').length} lines
        </span>
        <span className="text-2xs text-text-muted">
          Ctrl+Enter to apply
        </span>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-auto">
        <CodeMirror
          value={localCode}
          onChange={handleChange}
          extensions={extensions}
          theme={vscodeDark}
          style={{ height: '100%', fontSize: 12 }}
          basicSetup={{
            lineNumbers:        true,
            foldGutter:         true,
            autocompletion:     true,
            highlightActiveLine: true,
          }}
        />
      </div>
    </div>
  )
}
