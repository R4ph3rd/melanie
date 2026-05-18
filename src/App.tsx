import { useState, useRef, useEffect, useCallback } from 'react'
import { useStore } from './store/store'
import TopBar from './components/TopBar'
import Canvas from './components/Canvas'
import ExamplesPanel from './components/ExamplesPanel'
import CodePanel from './components/CodePanel'
import { ReactFlowProvider } from '@xyflow/react'
import { TooltipProvider } from './components/ui/tooltip'

const EXAMPLES_W   = 200
const CODE_W_MIN   = 200
const CODE_W_MAX   = 800
const CODE_W_DEFAULT = 380

export default function App() {
  const activeCodeNodeId    = useStore((s) => s.activeCodeNodeId)
  const setActiveCodeNodeId = useStore((s) => s.setActiveCodeNodeId)

  const [codeWidth, setCodeWidth] = useState(CODE_W_DEFAULT)
  const showCode = !!activeCodeNodeId

  // ── Resize drag logic ──────────────────────────────────────────────────────
  const dragging  = useRef(false)
  const startX    = useRef(0)
  const startW    = useRef(0)

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current   = e.clientX
    startW.current   = codeWidth
    document.body.style.cursor    = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [codeWidth])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const next = Math.max(CODE_W_MIN, Math.min(CODE_W_MAX, startW.current + (e.clientX - startX.current)))
      setCodeWidth(next)
    }
    const onMouseUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor    = ''
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
    <TooltipProvider delayDuration={400}>
    <div className="flex flex-col" style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Top bar */}
      <div className="relative flex-shrink-0">
        <TopBar />
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Examples panel */}
        <div
          className="flex-shrink-0 overflow-hidden panel-slide"
          style={{ width: EXAMPLES_W, borderRight: '1px solid #1e1e28' }}
        >
          <ExamplesPanel />
        </div>

        {/* Code panel + resize handle */}
        <div
          className="flex-shrink-0 flex overflow-hidden panel-slide"
          style={{
            width:         showCode ? codeWidth : 0,
            opacity:       showCode ? 1 : 0,
            pointerEvents: showCode ? 'auto' : 'none',
            transition:    dragging.current ? 'none' : undefined,
            position:      'relative',
          }}
        >
          {activeCodeNodeId && (
            <CodePanel
              nodeId={activeCodeNodeId}
              onClose={() => setActiveCodeNodeId(null)}
            />
          )}

          {/* Resize handle — right edge of panel */}
          {showCode && (
            <div
              onMouseDown={onResizeMouseDown}
              style={{
                position:   'absolute',
                top:        0,
                right:      0,
                width:      6,
                height:     '100%',
                cursor:     'col-resize',
                zIndex:     10,
                background: 'transparent',
              }}
              // Highlight on hover
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(124,58,237,0.3)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
            />
          )}
        </div>

        {/* Divider line (always visible when panel is open) */}
        {showCode && (
          <div style={{ width: 1, flexShrink: 0, background: '#2a2a3a' }} />
        )}

        {/* Canvas */}
        <div className="flex-1 overflow-hidden">
          <ReactFlowProvider>
            <Canvas />
          </ReactFlowProvider>
        </div>
      </div>
    </div>
    </TooltipProvider>
  )
}
