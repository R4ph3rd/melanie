import { useEffect, useMemo, useRef } from 'react'
import { useStore } from '../store/store'
import { getIframeWindow } from '../store/iframeRegistry'

const FPS = 30

// Routes captured canvas frames producer → consumer across feedback nodes.
// For each feedback node F: producer = sketch feeding F, consumer = sketch F feeds.
export default function FeedbackBridge() {
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)

  const links = useMemo(() => {
    const out: { producer: string; consumer: string }[] = []
    for (const f of nodes) {
      if (f.type !== 'feedback') continue
      const producer = edges.find((e) => e.target === f.id)?.source
      const consumer = edges.find((e) => e.source === f.id)?.target
      if (producer && consumer) out.push({ producer, consumer })
    }
    return out
  }, [nodes, edges])

  const linksRef = useRef(links)
  linksRef.current = links
  const active = links.length > 0

  useEffect(() => {
    if (!active) return

    // Route each producer's frame to its consumer(s). Copy (no transfer) so one
    // producer can fan out to several consumers, then free the bridge's bitmap.
    const onMsg = (e: MessageEvent) => {
      const d = e.data
      if (!d || d.type !== 'sketch-frame' || !d.nodeId || !d.bitmap) return
      const targets = linksRef.current.filter((l) => l.producer === d.nodeId)
      for (const l of targets) {
        getIframeWindow(l.consumer)?.postMessage({ type: 'feedback-frame', bitmap: d.bitmap }, '*')
      }
      if (d.bitmap.close) d.bitmap.close()
    }
    window.addEventListener('message', onMsg)

    // Ask every active producer for a fresh frame at a fixed rate.
    const interval = setInterval(() => {
      const producers = new Set(linksRef.current.map((l) => l.producer))
      for (const p of producers) getIframeWindow(p)?.postMessage({ type: 'request-frame' }, '*')
    }, 1000 / FPS)

    return () => { window.removeEventListener('message', onMsg); clearInterval(interval) }
  }, [active])

  return null
}
