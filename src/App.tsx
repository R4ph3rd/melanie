import { useState, useRef, useEffect, useCallback } from 'react'
import { useStore } from './store/store'
import TopBar from './components/TopBar'
import Canvas from './components/Canvas'
import ExamplesPanel from './components/ExamplesPanel'
import CodePanel from './components/CodePanel'
import { ReactFlowProvider } from '@xyflow/react'

const EXAMPLES_W     = 200
const CODE_W_MIN     = 200
const CODE_W_MAX     = 800
const CODE_W_DEFAULT = 380

export default function App() {
  const activeCodeNodeId    = useStore((s) => s.activeCodeNodeId)
  const setActiveCodeNodeId = useStore((s) => s.setActiveCodeNodeId)

  const [codeWidth,  setCodeWidth]  = useState(CODE_W_DEFAULT)
  const [isDragging, setIsDragging] = useState(false)
  const showCode = !!activeCodeNodeId

  // ── Resize drag logic ──────────────────────────────────────────────────────
  const dragging = useRef(false)
  const startX   = useRef(0)
  const startW   = useRef(0)

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current   = e.clientX
    startW.current   = codeWidth
    setIsDragging(true)
    document.body.style.cursor     = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [codeWidth])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const next = Math.max(CODE_W_MIN, Math.min(CODE_W_MAX,
        startW.current + (e.clientX - startX.current),
      ))
      setCodeWidth(next)
    }
    const onMouseUp = () => {
      if (!dragging.current) return
      dragging.current = false
      setIsDragging(false)
      document.body.style.cursor     = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup',   onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup',   onMouseUp)
    }
  }, [])

  return (
    <div className="flex flex-col" style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Top bar */}
      <div className="relative flex-shrink-0">
        <TopBar />
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Examples panel */}
        <div
          className="flex-shrink-0 overflow-hidden"
          style={{ width: EXAMPLES_W, borderRight: '1px solid #1e1e28' }}
        >
          <ExamplesPanel />
        </div>

        {/* Code panel: no transition while dragging so it tracks cursor live */}
        {showCode && (
          <div
            className="flex-shrink-0 overflow-hidden"
            style={{
              width:      codeWidth,
              transition: isDragging ? 'none' : 'width 0.2s ease',
            }}
          >
            <CodePanel
              nodeId={activeCodeNodeId}
              onClose={() => setActiveCodeNodeId(null)}
            />
          </div>
        )}

        {/* Visible + draggable resize handle : replaces the old decorative 1px divider */}
        {showCode && (
          <div
            onMouseDown={onResizeMouseDown}
            style={{
              width:      5,
              flexShrink: 0,
              cursor:     'col-resize',
              background: isDragging ? 'rgba(124,58,237,0.7)' : '#2a2a3a',
              transition: isDragging ? 'none' : 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!dragging.current)
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(124,58,237,0.45)'
            }}
            onMouseLeave={(e) => {
              if (!dragging.current)
                (e.currentTarget as HTMLDivElement).style.background = '#2a2a3a'
            }}
          />
        )}

        {/* Canvas */}
        <div className="flex-1 overflow-hidden">
          <ReactFlowProvider>
            <Canvas />
          </ReactFlowProvider>
        </div>
      </div>
    </div>
  )
}
