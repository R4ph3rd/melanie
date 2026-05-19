import { useState } from 'react'
import { EXAMPLE_SKETCHES } from '../utils/templates'
import { useStore } from '../store/store'
import SketchPreview from './SketchPreview'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

export default function ExamplesPanel() {
  const store    = useStore()
  const [search, setSearch] = useState('')

  const filtered = EXAMPLE_SKETCHES.filter(
    (e) =>
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase())
  )

  function addToCanvas(sketch: typeof EXAMPLE_SKETCHES[0]) {
    const x = 200 + Math.random() * 200
    const y = 100 + Math.random() * 200
    store.addSketchNode({ code: sketch.code, library: sketch.library, position: { x, y }, title: sketch.title })
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#0e0e14', borderRight: '1px solid #222' }}>
      {/* Header */}
      <div className="px-3 pt-3 pb-2 flex-shrink-0">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Examples</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="flex h-7 w-full rounded-md border border-border bg-input px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 min-h-0">
        <div className="space-y-2 pb-4 pt-1">
          {filtered.map((sketch) => (
            <button
              key={sketch.id}
              onClick={() => addToCanvas(sketch)}
              className="w-full text-left rounded-md overflow-hidden transition-all hover:ring-1 hover:ring-accent"
              style={{ background: '#131820', border: '1px solid #222', display: 'block' }}
              title={`Add "${sketch.title}" to canvas`}
            >
              {/* Scaled preview thumbnail */}
              <div
                className="overflow-hidden pointer-events-none"
                style={{ width: '100%', height: 80, background: '#0a0a0a' }}
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
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium text-foreground truncate">{sketch.title}</span>
                  <Badge variant={sketch.library === 'p5js' ? 'p5' : 'threejs'} className="rounded text-[10px] flex-shrink-0">
                    {sketch.library === 'p5js' ? 'p5' : '3js'}
                  </Badge>
                </div>
                <p className="text-2xs text-muted-foreground mt-0.5 line-clamp-2">{sketch.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* New sketch buttons */}
      <div className="h-px bg-border flex-shrink-0" />
      <div className="px-3 pb-3 pt-2 flex-shrink-0 space-y-1.5">
        <p className="text-2xs text-muted-foreground mb-1">New blank sketch</p>
        <Button
          onClick={() => store.addSketchNode({ library: 'p5js', position: { x: 200, y: 200 } })}
          variant="ghost"
          size="sm"
          className="w-full justify-start text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/50 border border-emerald-950"
        >
          <span>+</span> p5.js sketch
        </Button>
        <Button
          onClick={() => store.addSketchNode({ library: 'threejs', position: { x: 200, y: 300 } })}
          variant="ghost"
          size="sm"
          className="w-full justify-start text-blue-400 hover:text-blue-300 hover:bg-blue-950/50 border border-blue-950"
        >
          <span>+</span> three.js sketch
        </Button>
      </div>
    </div>
  )
}
