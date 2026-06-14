import { useRef, useEffect, memo } from 'react'
import type { LibraryType, Parameter } from '../utils/types'
import { buildIframeSrcdoc, extractParameters, extractDynamicOutputs } from '../utils/codeUtils'
import { useStore } from '../store/store'
import { getSignalValue, getNodeSignals } from '../store/signals'
import { registerIframe, unregisterIframe } from '../store/iframeRegistry'

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

  // Register this preview's window so the feedback bridge can route frames to it.
  useEffect(() => {
    if (!nodeId) return
    const win = iframeRef.current?.contentWindow
    if (win) registerIframe(nodeId, win)
    return () => unregisterIframe(nodeId)
  }, [nodeId, generationKey])

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

  // Forward signal values to the iframe each frame — read store state directly
  // inside the RAF loop so there are no React re-renders. Two flavours:
  //   1. source → param bindings (a channel drives one named parameter)
  //   2. sketch → sketch signal edges (every output() channel becomes a global)
  useEffect(() => {
    if (!nodeId) return
    let raf: number
    const tick = () => {
      const win = iframeRef.current?.contentWindow
      if (win) {
        const { signalBindings, edges, nodes } = useStore.getState()
        for (const b of signalBindings) {
          if (b.targetNodeId !== nodeId) continue
          win.postMessage({ type: 'live-var', name: b.paramName, value: getSignalValue(b.sourceNodeId, b.channel) }, '*')
        }
        for (const e of edges) {
          if (e.target !== nodeId || e.data?.kind !== 'signal' || e.data.bindingId || !e.source) continue
          const srcNode = nodes.find((n) => n.id === e.source)
          if (srcNode?.type !== 'sketch') continue
          // Runtime-accumulated channels (already emitted via output() at least once)
          const sig = getNodeSignals(e.source)
          for (const name in sig) win.postMessage({ type: 'live-var', name, value: sig[name] }, '*')
          // Static channels discovered in source code but not yet emitted: pre-declare as 0
          // so the consuming sketch can safely reference them before the first output() fires.
          const srcCode = (srcNode.data as { code?: string }).code ?? ''
          for (const ch of extractDynamicOutputs(srcCode)) {
            if (!(ch in sig)) win.postMessage({ type: 'live-var', name: ch, value: 0 }, '*')
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
