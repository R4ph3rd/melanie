import { useState } from 'react'
import { EXAMPLE_SKETCHES } from '../utils/templates'
import { useStore } from '../store'
import SketchPreview from './SketchPreview'

export default function ExamplesPanel() {
  const store    = useStore()
  const [search, setSearch] = useState('')

  const filtered = EXAMPLE_SKETCHES.filter(
    (e) =>
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase())
  )

  function addToCanvas(sketch: typeof EXAMPLE_SKETCHES[0]) {
    // Place at a slightly random offset from current visible area centre
    const x = 200 + Math.random() * 200
    const y = 100 + Math.random() * 200
    store.addSketchNode({
      code: sketch.code,
      library: sketch.library,
      position: { x, y },
      title: sketch.title,
    })
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#0e0e14', borderRight: '1px solid #222' }}>
      {/* Header */}
      <div className="px-3 pt-3 pb-2 flex-shrink-0">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
          Examples
        </h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="w-full px-2 py-1.5 rounded text-xs text-text-primary placeholder-text-muted outline-none"
          style={{ background: '#1a1a24', border: '1px solid #2a2a3a' }}
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-2">
        {filtered.map((sketch) => (
          <button
            key={sketch.id}
            onClick={() => addToCanvas(sketch)}
            className="w-full text-left rounded-md overflow-hidden transition-all hover:ring-1 hover:ring-accent"
            style={{ background: '#131820', border: '1px solid #222' }}
            title={`Add "${sketch.title}" to canvas`}
          >
            {/* Tiny preview */}
            <div
              className="w-full overflow-hidden pointer-events-none"
              style={{ height: 80, background: '#0a0a0a' }}
            >
              <div style={{ transform: 'scale(0.37)', transformOrigin: 'top left', width: 'calc(100% / 0.37)' }}>
                <SketchPreview
                  code={sketch.code}
                  library={sketch.library}
                  isRunning={true}
                  generationKey={0}
                  width={460}
                  height={200}
                />
              </div>
            </div>
            <div className="px-2 py-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-primary">{sketch.title}</span>
                <span
                  className="text-2xs px-1 py-0.5 rounded"
                  style={{
                    background: sketch.library === 'p5js' ? '#1a2a1a' : '#1a1a2e',
                    color: sketch.library === 'p5js' ? '#4ade80' : '#60a5fa',
                  }}
                >
                  {sketch.library === 'p5js' ? 'p5' : '3js'}
                </span>
              </div>
              <p className="text-2xs text-text-muted mt-0.5">{sketch.description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* New sketch buttons */}
      <div className="px-3 pb-3 pt-2 flex-shrink-0 space-y-1.5" style={{ borderTop: '1px solid #222' }}>
        <p className="text-2xs text-text-muted mb-1">New blank sketch</p>
        <button
          onClick={() => store.addSketchNode({ library: 'p5js', position: { x: 200, y: 200 } })}
          className="w-full px-3 py-2 rounded text-xs font-medium text-left flex items-center gap-2"
          style={{ background: '#1a2a1a', color: '#4ade80', border: '1px solid #1f3a1f' }}
        >
          <span>+</span> p5.js sketch
        </button>
        <button
          onClick={() => store.addSketchNode({ library: 'threejs', position: { x: 200, y: 300 } })}
          className="w-full px-3 py-2 rounded text-xs font-medium text-left flex items-center gap-2"
          style={{ background: '#1a1a2e', color: '#60a5fa', border: '1px solid #1f1f3a' }}
        >
          <span>+</span> three.js sketch
        </button>
      </div>
    </div>
  )
}
