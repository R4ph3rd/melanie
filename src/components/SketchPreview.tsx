import { useRef, useEffect, memo } from 'react'
import type { LibraryType, Parameter } from '../utils/types'
import { buildIframeSrcdoc, extractParameters } from '../utils/codeUtils'
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

  // Freeze the srcdoc per structural version: only a generationKey bump rebuilds
  // (and remounts) the iframe. Parameter tweaks change `code` but reuse the same
  // running sketch — pushed in live below — so animations never restart.
  const srcdocRef  = useRef('')
  const versionRef = useRef<string | null>(null)
  const prevParams = useRef<Parameter[]>([])
  const version    = `${library}:${generationKey}`
  if (versionRef.current !== version) {
    versionRef.current = version
    srcdocRef.current  = buildIframeSrcdoc(code, library, nodeId)
    prevParams.current = extractParameters(code)
  }

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(isRunning ? 'resume' : 'pause', '*')
  }, [isRunning])

  // Live parameter patching: when code changes without a remount, diff the params
  // and push only the changed values as live-vars (no iframe reload).
  useEffect(() => {
    const next = extractParameters(code)
    const win  = iframeRef.current?.contentWindow
    if (win) {
      for (const p of next) {
        const prev = prevParams.current.find((q) => q.name === p.name)
        if (p.kind === 'color') {
          if (!prev || prev.colorValue !== p.colorValue) {
            win.postMessage({ type: 'live-var', name: p.name, value: p.colorValue }, '*')
          }
        } else if (!prev || prev.value !== p.value) {
          win.postMessage({ type: 'live-var', name: p.name, value: p.value }, '*')
        }
      }
    }
    prevParams.current = next
  }, [code])

  // Forward bound signal values to the iframe each frame — read store state
  // directly inside the RAF loop so there are no React re-renders.
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
      key={`${nodeId ?? 'preview'}-${generationKey}`}
      ref={iframeRef}
      srcDoc={srcdocRef.current}
      width={width}
      height={height}
      sandbox="allow-scripts"
      style={{ border: 'none', display: 'block', borderRadius: '4px', background: '#111' }}
      title="sketch-preview"
    />
  )
})

export default SketchPreview
