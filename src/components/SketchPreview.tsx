import { useRef, useEffect, memo } from 'react'
import type { LibraryType } from '../utils/types'
import { buildIframeSrcdoc } from '../utils/codeUtils'
import { useStore } from '../store/store'
import { getSignalValue } from '../store/signals'

interface Props {
  code: string
  library: LibraryType
  isRunning: boolean
  generationKey: number
  width?: number
  height?: number
  nodeId?: string
}

const SketchPreview = memo(function SketchPreview({
  code, library, isRunning, generationKey, width = 260, height = 200, nodeId,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const srcdoc    = buildIframeSrcdoc(code, library, nodeId)

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(isRunning ? 'resume' : 'pause', '*')
  }, [isRunning])

  // Forward live signal bindings to the iframe each animation frame — no React
  // re-renders needed, we read store state directly inside the RAF loop.
  useEffect(() => {
    if (!nodeId) return
    let raf: number
    const tick = () => {
      const { signalBindings } = useStore.getState()
      const bindings = signalBindings.filter((b) => b.targetNodeId === nodeId)
      if (bindings.length > 0) {
        const win = iframeRef.current?.contentWindow
        if (win) {
          for (const b of bindings) {
            win.postMessage(
              { type: 'live-var', name: b.paramName, value: getSignalValue(b.sourceNodeId, b.channel) },
              '*',
            )
          }
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [nodeId])

  return (
    <iframe
      key={`${generationKey}-${code.length}`}
      ref={iframeRef}
      srcDoc={srcdoc}
      width={width}
      height={height}
      sandbox="allow-scripts"
      style={{ border: 'none', display: 'block', borderRadius: '4px', background: '#111' }}
      title="sketch-preview"
    />
  )
})

export default SketchPreview
