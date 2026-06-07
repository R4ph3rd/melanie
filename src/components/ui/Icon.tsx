import type { CSSProperties } from 'react'
import {
  Play, Pause, Restart, Code, Layers, Launch, CenterToFit, ShrinkScreenFilled, Close,
  MagicWand, Merge, Compare, Cut, Copy, TrashCan,
  Explore, Reset, ChildNode, ArrowsHorizontal,
  Flash, InProgress, Settings, Plug, Help, View, ViewOff, Checkmark,
  StopFilled, ZoomIn, ZoomOut, Locked, Unlocked, ChevronDown,
  Waveform, Microphone, Timer,
  Shuffle, Grid, Analytics, Activity,
  Cursor_1 as CursorIcon, Keyboard, ArrowDown, Music, Camera, Pin,
  ChartBar, Save, DocumentImport, Download, Loop,
} from '@carbon/icons-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICONS: Record<string, React.ElementType<any>> = {
  // Playback
  'play':               Play,
  'pause':              Pause,
  'restart':            Restart,

  // Canvas controls
  'code-editor':        Code,
  'display-background': StopFilled,
  'open-new-tab':       ShrinkScreenFilled,
  'zoom-to-fit':        CenterToFit,

  // Close / delete
  'delete':             Close,
  'close':              Close,

  // Ops
  'modify':             MagicWand,
  'merge':              Merge,
  'diff':               Compare,
  'extract':            Cut,
  'duplicate':          Copy,
  'reset':              TrashCan,

  // Axes
  'discover-axes':      Explore,
  'refresh':            Reset,
  'open-new-node':      ChildNode,

  // Param transfer
  'param-transfer':     ArrowsHorizontal,

  // Canvas controls
  'zoom-in':            ZoomIn,
  'zoom-out':           ZoomOut,
  'lock':               Locked,
  'unlock':             Unlocked,
  'chevron-down':       ChevronDown,

  // Generation
  'generate':           Flash,
  'loading':            InProgress,

  // Top bar
  'settings':           Settings,
  'connect':            Plug,
  'help':               Help,

  // API key
  'view':               View,
  'view-off':           ViewOff,
  'checkmark':          Checkmark,

  // Source nodes
  'lfo':          Waveform,
  'audio':        Microphone,
  'clock':        Timer,
  'noise':        Analytics,
  'pattern':      Grid,
  'random':       Shuffle,
  'audio-fft':    ChartBar,
  'audio-beat':   Activity,
  'mouse':        CursorIcon,
  'keyboard':     Keyboard,
  'scroll':       ArrowDown,
  'midi':         Music,
  'webcam':       Camera,
  'constant':     Pin,

  // Persistence / views / feedback
  'save-graph':   Save,
  'open-graph':   DocumentImport,
  'export':       Download,
  'compare':      Grid,
  'feedback':     Loop,
}

export type IconName = keyof typeof ICONS

interface Props {
  name: string
  size?: number
  className?: string
  style?: CSSProperties
}

export default function Icon({ name, size = 16, className, style }: Props) {
  const C = ICONS[name]
  if (!C) return null
  return <C size={size} className={className} style={style} />
}
