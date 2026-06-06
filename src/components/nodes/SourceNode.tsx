import { memo, useEffect, useRef, useState, useCallback } from 'react'
import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/react'
import type { SourceNodeData, LFOShape } from '../../utils/types'
import { useStore } from '../../store/store'
import Icon from '../ui/Icon'

type SourceNodeType = Node<SourceNodeData, 'source'>

// ── LFO helpers ───────────────────────────────────────────────────────────────

function lfoSample(phase: number, shape: LFOShape): number {
  switch (shape) {
    case 'square':   return phase < 0.5 ? 1 : 0
    case 'saw':      return phase
    case 'triangle': return phase < 0.5 ? phase * 2 : 2 - phase * 2
    default:         return (Math.sin(2 * Math.PI * phase) + 1) / 2  // sine, 0–1
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  root:        (color: string, selected: boolean): React.CSSProperties => ({
    background: '#111', borderRadius: 2, minWidth: 170,
    border: selected ? `1.5px solid ${color}` : '1px solid #2a2a2a',
    boxShadow: selected ? `0 0 0 2px ${color}25, 0 4px 20px rgba(0,0,0,0.6)` : '0 4px 20px rgba(0,0,0,0.5)',
  }),
  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', borderBottom: '1px solid #222', background: 'rgba(0,0,0,0.3)' } as React.CSSProperties,
  rfHandle:    { width: 10, height: 10, borderRadius: 1, border: 'none' } as React.CSSProperties,
  resizeHandle: { width: 10, height: 10, borderRadius: 2, border: '2px solid white', background: '#111' } as React.CSSProperties,
  deleteBtn:   { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, padding: 0, borderRadius: 2, border: '1px solid #2a2a2a', background: 'transparent', color: '#555', cursor: 'pointer', flexShrink: 0 } as React.CSSProperties,
  body:        { padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 } as React.CSSProperties,
  label:       { fontSize: 10, color: '#555', fontFamily: 'var(--font-mono)', marginBottom: 1 } as React.CSSProperties,
  row:         { display: 'flex', alignItems: 'center', gap: 6 } as React.CSSProperties,
  slider:      { flex: 1, height: 3, cursor: 'pointer' } as React.CSSProperties,
  val:         { fontSize: 10, fontFamily: 'var(--font-mono)', color: '#888', width: 32, textAlign: 'right' as const },
  handleLabel: { position: 'absolute' as const, right: 16, fontSize: 9, fontFamily: 'var(--font-mono)', color: '#666', pointerEvents: 'none' as const },
}

const SOURCE_META = {
  lfo:   { color: '#0ea5e9', label: 'LFO' },
  audio: { color: '#10b981', label: 'Audio' },
  clock: { color: '#f59e0b', label: 'Clock' },
}

const LFO_SHAPES: LFOShape[] = ['sine', 'square', 'saw', 'triangle']
const SHAPE_GLYPHS: Record<LFOShape, string> = { sine: '∿', square: '⊓', saw: '⊿', triangle: '∧' }

// ── MiniMeter ─────────────────────────────────────────────────────────────────

function MiniMeter({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 4, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color, borderRadius: 2, transition: 'width 50ms linear' }} />
    </div>
  )
}

// ── SourceNode ────────────────────────────────────────────────────────────────

const SourceNode = memo(function SourceNode({ id, data, selected }: NodeProps<SourceNodeType>) {
  const store    = useStore()
  const meta     = SOURCE_META[data.sourceType]
  const color    = meta.color
  const [liveVal, setLiveVal] = useState(0)

  // ── LFO ticker ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (data.sourceType !== 'lfo') return
    let raf: number
    const tick = (time: number) => {
      const rate  = (data.rate  as number) ?? 0.5
      const shape = (data.shape as LFOShape) ?? 'sine'
      const amp   = (data.amplitude as number) ?? 1
      const off   = (data.offset    as number) ?? 0
      const phase = (time / 1000 * rate) % 1
      const v     = off + amp * lfoSample(phase, shape)
      store.setSignalValue(id, 'value', v)
      setLiveVal(v)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [id, data.sourceType, data.rate, data.shape, data.amplitude, data.offset, store])

  // ── Audio level ticker ───────────────────────────────────────────────────────
  useEffect(() => {
    if (data.sourceType !== 'audio') return
    let audioCtx: AudioContext | null = null
    let stream: MediaStream | null    = null
    let analyser: AnalyserNode | null = null
    let raf: number

    navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then((s) => {
      stream   = s
      audioCtx = new AudioContext()
      analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      audioCtx.createMediaStreamSource(s).connect(analyser)
      const buf = new Uint8Array(analyser.fftSize)
      const tick = () => {
        analyser!.getByteTimeDomainData(buf)
        // RMS of deviation from 128 (silence), normalised to [0, 1]
        let sum = 0
        for (let i = 0; i < buf.length; i++) sum += (buf[i] - 128) ** 2
        const level = Math.min(1, Math.sqrt(sum / buf.length) / 64)
        store.setSignalValue(id, 'level', level)
        setLiveVal(level)
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }).catch(() => {
      // Microphone permission denied — emit silence
      store.setSignalValue(id, 'level', 0)
    })

    return () => {
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      audioCtx?.close()
    }
  }, [id, data.sourceType, store])

  // ── Clock ticker ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (data.sourceType !== 'clock') return
    let raf: number
    const tick = (time: number) => {
      const bpm   = (data.bpm as number) ?? 120
      const phase = (time / 1000 * bpm / 60) % 1
      const beat  = phase < 0.1 ? 1 : 0   // 10% duty-cycle pulse
      store.setSignalValue(id, 'phase', phase)
      store.setSignalValue(id, 'beat',  beat)
      setLiveVal(phase)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [id, data.sourceType, data.bpm, store])

  // ── Param handlers ───────────────────────────────────────────────────────────
  const set = useCallback((patch: Partial<SourceNodeData>) => store.updateSource(id, patch), [id, store])

  return (
    <div style={S.root(color, !!selected)}>
      <NodeResizer isVisible={!!selected} minWidth={160} minHeight={80} color={color} handleStyle={S.resizeHandle} lineStyle={{ display: 'none' }} />

      {/* Input handle for possible future chaining (not used yet) */}
      <Handle type="target" position={Position.Left} id="in" style={{ ...S.rfHandle, background: '#333', opacity: 0 }} />

      {data.sourceType === 'clock' ? (
        <>
          <Handle type="source" position={Position.Right} id="phase" style={{ ...S.rfHandle, background: color, top: '35%' }} />
          <Handle type="source" position={Position.Right} id="beat"  style={{ ...S.rfHandle, background: color, top: '65%' }} />
        </>
      ) : (
        <Handle type="source" position={Position.Right} id="value" style={{ ...S.rfHandle, background: color }} />
      )}

      {/* Header */}
      <div style={S.header}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, flexShrink: 0, border: `2px solid ${color}`, borderRadius: 2 }}>
            <Icon name={data.sourceType} size={10} />
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{meta.label}</span>
        </span>
        <button style={S.deleteBtn} onClick={() => store.deleteNode(id)} title="Delete">
          <Icon name="delete" size={9} />
        </button>
      </div>

      {/* Body */}
      <div className="nodrag nopan" style={S.body} onPointerDown={(e) => e.stopPropagation()}>

        {/* Live meter */}
        <MiniMeter value={liveVal} color={color} />

        {data.sourceType === 'lfo' && <>
          {/* Rate */}
          <div>
            <div style={S.label}>rate</div>
            <div style={S.row}>
              <input type="range" min={0.05} max={10} step={0.05}
                value={(data.rate as number) ?? 0.5}
                onChange={(e) => set({ rate: parseFloat(e.target.value) })}
                className="nodrag nopan" style={{ ...S.slider, accentColor: color }}
              />
              <span style={S.val}>{((data.rate as number) ?? 0.5).toFixed(2)}</span>
            </div>
          </div>
          {/* Shape */}
          <div>
            <div style={S.label}>shape</div>
            <div style={{ display: 'flex', gap: 3 }}>
              {LFO_SHAPES.map((sh) => (
                <button key={sh} onClick={() => set({ shape: sh })}
                  style={{
                    flex: 1, padding: '2px 0', borderRadius: 2, border: `1px solid ${data.shape === sh ? color : '#333'}`,
                    background: data.shape === sh ? `${color}22` : 'transparent',
                    color: data.shape === sh ? color : '#555',
                    fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-mono)',
                  }}
                  title={sh}
                >{SHAPE_GLYPHS[sh]}</button>
              ))}
            </div>
          </div>
          {/* Amplitude */}
          <div>
            <div style={S.label}>amplitude</div>
            <div style={S.row}>
              <input type="range" min={0} max={1} step={0.01}
                value={(data.amplitude as number) ?? 1}
                onChange={(e) => set({ amplitude: parseFloat(e.target.value) })}
                className="nodrag nopan" style={{ ...S.slider, accentColor: color }}
              />
              <span style={S.val}>{((data.amplitude as number) ?? 1).toFixed(2)}</span>
            </div>
          </div>
          {/* Offset */}
          <div>
            <div style={S.label}>offset</div>
            <div style={S.row}>
              <input type="range" min={0} max={1} step={0.01}
                value={(data.offset as number) ?? 0}
                onChange={(e) => set({ offset: parseFloat(e.target.value) })}
                className="nodrag nopan" style={{ ...S.slider, accentColor: color }}
              />
              <span style={S.val}>{((data.offset as number) ?? 0).toFixed(2)}</span>
            </div>
          </div>
        </>}

        {data.sourceType === 'audio' && (
          <p style={{ fontSize: 10, color: '#555', margin: 0, lineHeight: 1.5 }}>
            Microphone RMS level.<br />Emits on channel <span style={{ color: meta.color }}>level</span>.
          </p>
        )}

        {data.sourceType === 'clock' && <>
          {/* BPM */}
          <div>
            <div style={S.label}>bpm</div>
            <div style={S.row}>
              <input type="range" min={20} max={300} step={1}
                value={(data.bpm as number) ?? 120}
                onChange={(e) => set({ bpm: parseInt(e.target.value) })}
                className="nodrag nopan" style={{ ...S.slider, accentColor: color }}
              />
              <span style={S.val}>{(data.bpm as number) ?? 120}</span>
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <p style={{ fontSize: 10, color: '#555', margin: 0, lineHeight: 1.8 }}>
              <span style={{ color }}>phase</span> 0–1 sawtooth<br />
              <span style={{ color }}>beat</span> pulse on downbeat
            </p>
          </div>
        </>}
      </div>

      {/* Handle channel labels */}
      {data.sourceType === 'clock' && (
        <div style={{ position: 'absolute', right: 16, top: 0, bottom: 0, pointerEvents: 'none' }}>
          <span style={{ ...S.handleLabel, top: 'calc(35% - 6px)' }}>phase</span>
          <span style={{ ...S.handleLabel, top: 'calc(65% - 6px)' }}>beat</span>
        </div>
      )}
    </div>
  )
})

export default SourceNode
