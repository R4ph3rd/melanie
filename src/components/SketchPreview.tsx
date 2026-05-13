import { useRef, useEffect, memo } from 'react'
import type { LibraryType } from '../types'
import { buildIframeSrcdoc } from '../utils/codeUtils'

interface Props {
  code: string
  library: LibraryType
  isRunning: boolean
  generationKey: number
  width?: number
  height?: number
}

const SketchPreview = memo(function SketchPreview({
  code,
  library,
  isRunning,
  generationKey,
  width = 260,
  height = 200,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const srcdoc = buildIframeSrcdoc(code, library)

  // Send pause/resume messages without reloading the iframe
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(isRunning ? 'resume' : 'pause', '*')
  }, [isRunning])

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
