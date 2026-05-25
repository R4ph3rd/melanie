import type { CSSProperties } from 'react'

// Inner SVG markup for each icon (all share the same base attrs on the outer <svg>)
const PATHS: Record<string, string> = {
  'play':               '<polygon points="4,2 14,8 4,14"/>',
  'pause':              '<rect x="3" y="3" width="3.5" height="10"/><rect x="9.5" y="3" width="3.5" height="10"/>',
  'restart':            '<path d="M12 4a6 6 0 11-8 1"/><polyline points="4,2 4,5 7,5"/>',
  'code-editor':        '<polyline points="5,4 2,8 5,12"/><polyline points="11,4 14,8 11,12"/><line x1="8" y1="3" x2="7" y2="13"/>',
  'display-background': '<rect x="1" y="1" width="14" height="14"/><circle cx="8" cy="8" r="4" fill="currentColor" stroke="none"/>',
  'open-new-tab':       '<polyline points="7,3 3,3 3,13 13,13 13,9"/><line x1="9" y1="3" x2="14" y2="3"/><line x1="14" y1="3" x2="14" y2="8"/><line x1="8" y1="9" x2="14" y2="3"/>',
  'open-new-node':      '<rect x="7" y="5" width="8" height="6"/><line x1="1" y1="8" x2="7" y2="8"/><polyline points="4,5 7,8 4,11"/>',
  'zoom-to-fit':        '<polyline points="2,5 2,2 5,2"/><polyline points="11,2 14,2 14,5"/><polyline points="14,11 14,14 11,14"/><polyline points="5,14 2,14 2,11"/><line x1="2" y1="2" x2="6" y2="6"/><line x1="14" y1="2" x2="10" y2="6"/><line x1="14" y1="14" x2="10" y2="10"/><line x1="2" y1="14" x2="6" y2="10"/>',
  'delete':             '<line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>',
  'modify':             '<path d="M9.5 3.5L12.5 6.5L6 13H3V10L9.5 3.5Z"/><line x1="7.5" y1="5" x2="11" y2="8.5"/>',
  'merge':              '<rect x="1" y="3" width="3" height="3"/><rect x="1" y="10" width="3" height="3"/><line x1="4" y1="4.5" x2="8" y2="8"/><line x1="4" y1="11.5" x2="8" y2="8"/><line x1="8" y1="8" x2="15" y2="8"/>',
  'diff':               '<line x1="8" y1="2" x2="8" y2="7"/><line x1="8" y1="9" x2="8" y2="14"/><line x1="5" y1="5" x2="11" y2="5"/><line x1="5" y1="11" x2="11" y2="11"/>',
  'extract':            '<rect x="3" y="3" width="10" height="10"/><polyline points="6,8 8,6 10,8"/><line x1="8" y1="6" x2="8" y2="11"/>',
  'duplicate':          '<rect x="6" y="6" width="7" height="7"/><rect x="3" y="3" width="7" height="7"/>',
  'expand':             '<polyline points="2,10 2,14 6,14"/><polyline points="14,6 14,2 10,2"/><line x1="8" y1="8" x2="14" y2="2"/><line x1="8" y1="8" x2="2" y2="14"/>',
  'sketch':             '<path d="M3 13L6 4l5 6 2-3 1 6"/><circle cx="13" cy="5" r="1.5" fill="currentColor" stroke="none"/>',
}

interface SvgIconProps {
  name: string
  size?: number
  className?: string
  style?: CSSProperties
}

export default function SvgIcon({ name, size = 16, className, style }: SvgIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      style={style}
      className={className}
      dangerouslySetInnerHTML={{ __html: PATHS[name] ?? '' }}
    />
  )
}
