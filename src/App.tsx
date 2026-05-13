import { useStore } from './store'
import TopBar from './components/TopBar'
import Canvas from './components/Canvas'
import ExamplesPanel from './components/ExamplesPanel'
import CodePanel from './components/CodePanel'
import { ReactFlowProvider } from '@xyflow/react'

const EXAMPLES_W = 200
const CODE_W     = 380

export default function App() {
  const activeCodeNodeId     = useStore((s) => s.activeCodeNodeId)
  const setActiveCodeNodeId  = useStore((s) => s.setActiveCodeNodeId)

  const showCode = !!activeCodeNodeId

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
          className="flex-shrink-0 overflow-hidden panel-slide"
          style={{ width: EXAMPLES_W, borderRight: '1px solid #1e1e28' }}
        >
          <ExamplesPanel />
        </div>

        {/* Code panel (slide in when active) */}
        <div
          className="flex-shrink-0 overflow-hidden panel-slide"
          style={{
            width: showCode ? CODE_W : 0,
            opacity: showCode ? 1 : 0,
            borderRight: showCode ? '1px solid #2a2a3a' : 'none',
            pointerEvents: showCode ? 'auto' : 'none',
          }}
        >
          {activeCodeNodeId && (
            <CodePanel
              nodeId={activeCodeNodeId}
              onClose={() => setActiveCodeNodeId(null)}
            />
          )}
        </div>

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
