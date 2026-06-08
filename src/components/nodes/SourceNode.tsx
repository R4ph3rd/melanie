import { memo, useEffect, useRef, useState, useCallback } from 'react'
import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/react'
import type { SourceNodeData, LFOShape, SourceType } from '../../utils/types'
import { SOURCE_CHANNELS } from '../../utils/types'
import { setSignalValue } from '../../store/signals'
import { useStore } from '../../store/store'
import Icon from '../ui/Icon'

type SourceNodeType = Node<SourceNodeData, 'source'>

// ── Helpers ───────────────────────────────────────────────────────────────────

function lfoSample(phase: number, shape: LFOShape): number {
  switch (shape) {
    case 'square':   return phase < 0.5 ? 1 : 0
    case 'saw':      return phase
    case 'triangle': return phase < 0.5 ? phase * 2 : 2 - phase * 2
    default:         return (Math.sin(2 * Math.PI * phase) + 1) / 2
  }
}

function smoothstep(f: number) { return f * f * (3 - 2 * f) }

function handleTop(i: number, total: number) { return `${100 * (i + 1) / (total + 1)}%` }

// ── Meta ──────────────────────────────────────────────────────────────────────

const SOURCE_META: Record<SourceType, { color: string; label: string }> = {
  lfo:          { color: '#0ea5e9', label: 'LFO' },
  clock:        { color: '#f59e0b', label: 'Clock' },
  noise:        { color: '#8b5cf6', label: 'Noise' },
  pattern:      { color: '#ec4899', label: 'Pattern' },
  random:       { color: '#6366f1', label: 'Random' },
  audio:        { color: '#10b981', label: 'Level' },
  'audio-fft':  { color: '#14b8a6', label: 'FFT' },
  'audio-beat': { color: '#f97316', label: 'Beat' },
  mouse:        { color: '#a3e635', label: 'Mouse' },
  keyboard:     { color: '#facc15', label: 'Keyboard' },
  scroll:       { color: '#fb923c', label: 'Scroll' },
  midi:         { color: '#e879f9', label: 'MIDI' },
  webcam:       { color: '#60a5fa', label: 'Webcam' },
  constant:     { color: '#94a3b8', label: 'Constant' },
}

const LFO_SHAPES: LFOShape[] = ['sine', 'square', 'saw', 'triangle']
const SHAPE_GLYPHS: Record<LFOShape, string> = { sine: '∿', square: '⊓', saw: '⊿', triangle: '∧' }

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  root:        (color: string, selected: boolean): React.CSSProperties => ({
    background: '#111', borderRadius: 2, minWidth: 170,
    border: selected ? `1.5px solid ${color}` : '1px solid #2a2a2a',
    boxShadow: selected ? `0 0 0 2px ${color}25, 0 4px 20px rgba(0,0,0,0.6)` : '0 4px 20px rgba(0,0,0,0.5)',
  }),
  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', borderBottom: '1px solid #222', background: 'rgba(0,0,0,0.3)' } as React.CSSProperties,
  rfHandle:    { width: 10, height: 10, borderRadius: 1, border: 'none' } as React.CSSProperties,
  resizeHandle:{ width: 10, height: 10, borderRadius: 2, border: '2px solid white', background: '#111' } as React.CSSProperties,
  deleteBtn:   { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, padding: 0, borderRadius: 2, border: '1px solid #2a2a2a', background: 'transparent', color: '#555', cursor: 'pointer', flexShrink: 0 } as React.CSSProperties,
  body:        { padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 } as React.CSSProperties,
  label:       { fontSize: 10, color: '#555', fontFamily: 'var(--font-mono)', marginBottom: 1 } as React.CSSProperties,
  row:         { display: 'flex', alignItems: 'center', gap: 6 } as React.CSSProperties,
  slider:      { flex: 1, height: 3, cursor: 'pointer' } as React.CSSProperties,
  val:         { fontSize: 10, fontFamily: 'var(--font-mono)', color: '#888', width: 32, textAlign: 'right' as const },
  handleLabel: { position: 'absolute' as const, right: 16, fontSize: 9, fontFamily: 'var(--font-mono)', color: '#666', pointerEvents: 'none' as const },
  dim:         { fontSize: 10, color: '#555', margin: 0, lineHeight: 1.6 } as React.CSSProperties,
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MiniMeter({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 4, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color, borderRadius: 2, transition: 'width 50ms linear' }} />
    </div>
  )
}

interface SliderRowProps {
  label: string; min: number; max: number; step: number
  value: number; color: string; fmt?: (v: number) => string
  onChange: (v: number) => void
}
function SliderRow({ label, min, max, step, value, color, fmt, onChange }: SliderRowProps) {
  return (
    <div>
      <div style={S.label}>{label}</div>
      <div style={S.row}>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="nodrag nopan" style={{ ...S.slider, accentColor: color }}
        />
        <span style={S.val}>{fmt ? fmt(value) : value.toFixed(2)}</span>
      </div>
    </div>
  )
}

// ── SourceNode ────────────────────────────────────────────────────────────────

const SourceNode = memo(function SourceNode({ id, data, selected }: NodeProps<SourceNodeType>) {
  const store    = useStore()
  const meta     = SOURCE_META[data.sourceType] ?? SOURCE_META.lfo
  const color    = meta.color
  const channels = SOURCE_CHANNELS[data.sourceType] ?? ['value']
  const [liveVal, setLiveVal] = useState(0)
  const noiseTable = useRef<Float32Array | null>(null)

  const set = useCallback((patch: Partial<SourceNodeData>) => store.updateSource(id, patch), [id, store])

  // ── LFO ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (data.sourceType !== 'lfo') return
    let raf: number
    const tick = (time: number) => {
      const rate  = (data.rate      as number)   ?? 0.5
      const shape = (data.shape     as LFOShape) ?? 'sine'
      const amp   = (data.amplitude as number)   ?? 1
      const off   = (data.offset    as number)   ?? 0
      const phase = (time / 1000 * rate) % 1
      const v     = off + amp * lfoSample(phase, shape)
      setSignalValue(id, 'value', v)
      setLiveVal(v)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [id, data.sourceType, data.rate, data.shape, data.amplitude, data.offset])

  // ── Clock ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (data.sourceType !== 'clock') return
    let raf: number
    const tick = (time: number) => {
      const bpm   = (data.bpm as number) ?? 120
      const phase = (time / 1000 * bpm / 60) % 1
      setSignalValue(id, 'phase', phase)
      setSignalValue(id, 'beat',  phase < 0.1 ? 1 : 0)
      setLiveVal(phase)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [id, data.sourceType, data.bpm])

  // ── Noise ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (data.sourceType !== 'noise') return
    if (!noiseTable.current) {
      noiseTable.current = new Float32Array(256)
      for (let i = 0; i < 256; i++) noiseTable.current[i] = Math.random()
    }
    const table = noiseTable.current
    let raf: number
    const tick = (time: number) => {
      const freq = (data.freq as number) ?? 0.5
      const x    = (time / 1000) * freq * 4
      const i    = Math.floor(x) & 255
      const f    = smoothstep(x - Math.floor(x))
      const v    = table[i] * (1 - f) + table[(i + 1) & 255] * f
      setSignalValue(id, 'value', v)
      setLiveVal(v)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [id, data.sourceType, data.freq])

  // ── Pattern ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (data.sourceType !== 'pattern') return
    let raf: number
    const tick = (time: number) => {
      const bpm    = (data.bpm    as number)   ?? 120
      const len    = (data.length as number)   ?? 8
      const steps  = (data.steps  as number[]) ?? Array(len).fill(0)
      const sixteenth = 60 / bpm / 4
      const step   = Math.floor((time / 1000) / sixteenth) % len
      const value  = steps[step] ?? 0
      setSignalValue(id, 'value', value)
      setSignalValue(id, 'step',  len > 1 ? step / (len - 1) : 0)
      setLiveVal(value)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [id, data.sourceType, data.bpm, data.steps, data.length])

  // ── Random ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (data.sourceType !== 'random') return
    let raf: number
    let lastT = 0
    let cur = Math.random()
    let tgt = Math.random()
    const tick = (time: number) => {
      const freq       = (data.freq   as number)  ?? 2
      const smooth     = (data.smooth as boolean) ?? true
      const intervalMs = 1000 / freq
      if (time - lastT >= intervalMs) { cur = tgt; tgt = Math.random(); lastT = time }
      const v = smooth ? cur + (tgt - cur) * ((time - lastT) / intervalMs) : cur
      setSignalValue(id, 'value', v)
      setLiveVal(v)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [id, data.sourceType, data.freq, data.smooth])

  // ── Audio Level ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (data.sourceType !== 'audio') return
    let audioCtx: AudioContext | null = null
    let stream: MediaStream | null = null
    let analyser: AnalyserNode | null = null
    let raf: number
    navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then((s) => {
      stream = s; audioCtx = new AudioContext(); analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      audioCtx.createMediaStreamSource(s).connect(analyser)
      const buf = new Uint8Array(analyser.fftSize)
      const tick = () => {
        analyser!.getByteTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) sum += (buf[i] - 128) ** 2
        const v = Math.min(1, Math.sqrt(sum / buf.length) / 64)
        setSignalValue(id, 'level', v); setLiveVal(v)
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }).catch(() => { setSignalValue(id, 'level', 0) })
    return () => { cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); audioCtx?.close() }
  }, [id, data.sourceType])

  // ── Audio FFT ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (data.sourceType !== 'audio-fft') return
    let audioCtx: AudioContext | null = null
    let stream: MediaStream | null = null
    let analyser: AnalyserNode | null = null
    let raf: number
    navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then((s) => {
      stream = s; audioCtx = new AudioContext(); analyser = audioCtx.createAnalyser()
      analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.8
      audioCtx.createMediaStreamSource(s).connect(analyser)
      const buf = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser!.getByteFrequencyData(buf)
        const nyquist  = audioCtx!.sampleRate / 2
        const binWidth = nyquist / buf.length
        const avg = (lo: number, hi: number) => {
          const a = Math.floor(lo / binWidth)
          const b = Math.min(Math.floor(hi / binWidth), buf.length - 1)
          let s = 0; for (let i = a; i <= b; i++) s += buf[i]
          return s / ((b - a + 1) * 255)
        }
        const bass = avg(80, 250)
        setSignalValue(id, 'sub',      avg(20,   80))
        setSignalValue(id, 'bass',     bass)
        setSignalValue(id, 'mid',      avg(250,  2000))
        setSignalValue(id, 'treble',   avg(2000, 8000))
        setSignalValue(id, 'presence', avg(8000, 20000))
        setLiveVal(bass)
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }).catch(() => {})
    return () => { cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); audioCtx?.close() }
  }, [id, data.sourceType])

  // ── Audio Beat ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (data.sourceType !== 'audio-beat') return
    let audioCtx: AudioContext | null = null
    let stream: MediaStream | null = null
    let analyser: AnalyserNode | null = null
    let raf: number
    let prevEnergy = 0; let beatDecay = 0
    navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then((s) => {
      stream = s; audioCtx = new AudioContext(); analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      audioCtx.createMediaStreamSource(s).connect(analyser)
      const buf = new Uint8Array(analyser.fftSize)
      const tick = () => {
        analyser!.getByteTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) sum += (buf[i] - 128) ** 2
        const energy  = Math.min(1, Math.sqrt(sum / buf.length) / 64)
        if (energy - prevEnergy > 0.3) beatDecay = 1
        else beatDecay = Math.max(0, beatDecay - 0.06)
        prevEnergy = energy * 0.7 + prevEnergy * 0.3
        setSignalValue(id, 'beat',   beatDecay)
        setSignalValue(id, 'energy', energy)
        setLiveVal(energy)
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }).catch(() => {})
    return () => { cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); audioCtx?.close() }
  }, [id, data.sourceType])

  // ── Mouse ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (data.sourceType !== 'mouse') return
    let speed = 0; let px = 0; let py = 0; let raf: number
    const onMove = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth
      const y = e.clientY / window.innerHeight
      speed = Math.min(1, Math.hypot(x - px, y - py) * 20)
      px = x; py = y
      setSignalValue(id, 'x', x); setSignalValue(id, 'y', y)
    }
    const onDown = () => setSignalValue(id, 'click', 1)
    const onUp   = () => setSignalValue(id, 'click', 0)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup',   onUp)
    const tick = () => {
      speed *= 0.9
      setSignalValue(id, 'speed', speed); setLiveVal(px)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [id, data.sourceType])

  // ── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (data.sourceType !== 'keyboard') return
    const held = new Set<string>(); let pressDecay = 0; let raf: number
    const onDown = (e: KeyboardEvent) => { if (!held.has(e.key)) { held.add(e.key); pressDecay = 1 } }
    const onUp   = (e: KeyboardEvent) => held.delete(e.key)
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup',   onUp)
    const tick = () => {
      pressDecay = Math.max(0, pressDecay - 0.05)
      const h = held.size > 0 ? 1 : 0
      setSignalValue(id, 'held',  h)
      setSignalValue(id, 'press', pressDecay)
      setLiveVal(h)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup',   onUp)
    }
  }, [id, data.sourceType])

  // ── Scroll ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (data.sourceType !== 'scroll') return
    let velocity = 0; let lastY = window.scrollY; let raf: number
    const onScroll = () => {
      const cur  = window.scrollY
      const maxY = Math.max(document.body.scrollHeight - window.innerHeight, 1)
      velocity   = Math.min(1, Math.abs(cur - lastY) / 100)
      lastY      = cur
      setSignalValue(id, 'y', cur / maxY)
      setSignalValue(id, 'velocity', velocity)
    }
    window.addEventListener('scroll', onScroll)
    const tick = () => {
      velocity = Math.max(0, velocity - 0.05)
      setSignalValue(id, 'velocity', velocity); setLiveVal(velocity)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', onScroll) }
  }, [id, data.sourceType])

  // ── MIDI ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (data.sourceType !== 'midi') return
    if (!navigator.requestMIDIAccess) return
    let raf: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let midiAccess: any = null
    let note = 0; let vel = 0; let active = 0; let cc = 0
    navigator.requestMIDIAccess().then((access: unknown) => {
      midiAccess = access as any // eslint-disable-line @typescript-eslint/no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handleMsg = (e: any) => {
        const [status, d1, d2] = e.data as [number, number, number]
        const type = status & 0xf0
        if (type === 0x90 && d2 > 0) { note = d1 / 127; vel = d2 / 127; active = 1 }
        else if (type === 0x80 || (type === 0x90 && d2 === 0)) { active = 0; vel = 0 }
        else if (type === 0xb0) { cc = d2 / 127 }
        setSignalValue(id, 'note', note); setSignalValue(id, 'velocity', vel)
        setSignalValue(id, 'active', active); setSignalValue(id, 'cc', cc)
      }
      for (const input of midiAccess.inputs.values()) input.onmidimessage = handleMsg
      midiAccess.onstatechange = () => {
        for (const input of midiAccess.inputs.values()) input.onmidimessage = handleMsg
      }
    }).catch(() => {})
    const tick = () => { setLiveVal(active); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      if (midiAccess) for (const input of midiAccess.inputs.values()) input.onmidimessage = null
    }
  }, [id, data.sourceType])

  // ── Webcam ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (data.sourceType !== 'webcam') return
    let stream: MediaStream | null = null; let raf: number
    const video  = document.createElement('video')
    const canvas = document.createElement('canvas')
    canvas.width = 64; canvas.height = 48
    const ctx = canvas.getContext('2d')!
    let prevData: Uint8ClampedArray | null = null
    navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then((s) => {
      stream = s; video.srcObject = s; video.play()
      const tick = () => {
        if (video.readyState >= 2) {
          ctx.drawImage(video, 0, 0, 64, 48)
          const d   = ctx.getImageData(0, 0, 64, 48).data
          const len = d.length / 4
          let r = 0, g = 0, b = 0, motion = 0
          for (let i = 0; i < len; i++) {
            r += d[i * 4]; g += d[i * 4 + 1]; b += d[i * 4 + 2]
            if (prevData) {
              const dr = d[i*4] - prevData[i*4], dg = d[i*4+1] - prevData[i*4+1], db = d[i*4+2] - prevData[i*4+2]
              motion += Math.sqrt(dr*dr + dg*dg + db*db)
            }
          }
          const nr = r / (len * 255), ng = g / (len * 255), nb = b / (len * 255)
          const brightness = (nr + ng + nb) / 3
          setSignalValue(id, 'brightness', brightness)
          setSignalValue(id, 'r', nr); setSignalValue(id, 'g', ng); setSignalValue(id, 'b', nb)
          setSignalValue(id, 'motion', Math.min(1, motion / (len * 255)))
          setLiveVal(brightness)
          prevData = new Uint8ClampedArray(d)
        }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }).catch(() => {})
    return () => { cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()) }
  }, [id, data.sourceType])

  // ── Constant ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (data.sourceType !== 'constant') return
    const v = (data.value as number) ?? 0.5
    setSignalValue(id, 'value', v); setLiveVal(v)
  }, [id, data.sourceType, data.value])

  // ── Render ────────────────────────────────────────────────────────────────

  const st = data.sourceType

  return (
    <div style={S.root(color, !!selected)}>
      <NodeResizer isVisible={!!selected} minWidth={160} minHeight={80} color={color} handleStyle={S.resizeHandle} lineStyle={{ display: 'none' }} />

      <Handle type="target" position={Position.Left} id="in" style={{ ...S.rfHandle, background: '#333', opacity: 0 }} />
      {channels.map((ch, i) => (
        <Handle key={ch} type="source" position={Position.Right} id={ch}
          style={{ ...S.rfHandle, background: color, top: handleTop(i, channels.length) }}
        />
      ))}

      {/* Header */}
      <div style={S.header}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, flexShrink: 0, border: `2px solid ${color}`, borderRadius: 2 }}>
            <Icon name={st} size={10} />
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{meta.label}</span>
        </span>
        <button style={S.deleteBtn} onClick={() => store.deleteNode(id)} title="Delete">
          <Icon name="delete" size={9} />
        </button>
      </div>

      {/* Body */}
      <div className="nodrag nopan" style={S.body} onPointerDown={(e) => e.stopPropagation()}>
        <MiniMeter value={liveVal} color={color} />

        {st === 'lfo' && <>
          <SliderRow label="rate" min={0.05} max={10} step={0.05} value={(data.rate as number) ?? 0.5} color={color} onChange={(v) => set({ rate: v })} />
          <div>
            <div style={S.label}>shape</div>
            <div style={{ display: 'flex', gap: 3 }}>
              {LFO_SHAPES.map((sh) => (
                <button key={sh} onClick={() => set({ shape: sh })}
                  style={{ flex: 1, padding: '2px 0', borderRadius: 2, border: `1px solid ${data.shape === sh ? color : '#333'}`, background: data.shape === sh ? `${color}22` : 'transparent', color: data.shape === sh ? color : '#555', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
                  title={sh}>{SHAPE_GLYPHS[sh as LFOShape]}</button>
              ))}
            </div>
          </div>
          <SliderRow label="amplitude" min={0} max={1} step={0.01} value={(data.amplitude as number) ?? 1} color={color} onChange={(v) => set({ amplitude: v })} />
          <SliderRow label="offset"    min={0} max={1} step={0.01} value={(data.offset    as number) ?? 0} color={color} onChange={(v) => set({ offset: v })} />
        </>}

        {st === 'clock' && <>
          <SliderRow label="bpm" min={20} max={300} step={1} value={(data.bpm as number) ?? 120} color={color} fmt={(v) => String(Math.round(v))} onChange={(v) => set({ bpm: v })} />
          <p style={S.dim}><span style={{ color }}>phase</span> 0–1 saw &nbsp; <span style={{ color }}>beat</span> pulse</p>
        </>}

        {st === 'noise' && (
          <SliderRow label="freq" min={0.05} max={5} step={0.05} value={(data.freq as number) ?? 0.5} color={color} onChange={(v) => set({ freq: v })} />
        )}

        {st === 'pattern' && (() => {
          const len   = (data.length as number)   ?? 8
          const steps = (data.steps  as number[]) ?? Array(len).fill(0)
          return (
            <>
              <SliderRow label="bpm" min={20} max={300} step={1} value={(data.bpm as number) ?? 120} color={color} fmt={(v) => String(Math.round(v))} onChange={(v) => set({ bpm: v })} />
              <div>
                <div style={S.label}>steps</div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${len}, 1fr)`, gap: 2 }}>
                  {steps.map((v, i) => (
                    <button key={i} onClick={() => {
                      const next = [...steps]; next[i] = v > 0 ? 0 : 1; set({ steps: next })
                    }}
                      style={{ height: 16, borderRadius: 2, border: 'none', background: v > 0 ? color : '#222', cursor: 'pointer', opacity: v > 0 ? 1 : 0.4 }}
                    />
                  ))}
                </div>
              </div>
            </>
          )
        })()}

        {st === 'random' && <>
          <SliderRow label="freq (Hz)" min={0.1} max={20} step={0.1} value={(data.freq as number) ?? 2} color={color} onChange={(v) => set({ freq: v })} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!(data.smooth ?? true)} onChange={(e) => set({ smooth: e.target.checked })} className="nodrag" />
            <span style={S.label}>smooth</span>
          </label>
        </>}

        {(st === 'audio' || st === 'audio-fft' || st === 'audio-beat') && (
          <p style={S.dim}>
            {st === 'audio'      && <>Mic RMS level → <span style={{ color }}>level</span></>}
            {st === 'audio-fft'  && <>FFT bands → <span style={{ color }}>sub · bass · mid · treble · presence</span></>}
            {st === 'audio-beat' && <>Onset detect → <span style={{ color }}>beat · energy</span></>}
          </p>
        )}

        {st === 'mouse' && (
          <p style={S.dim}><span style={{ color }}>x · y</span> pos &nbsp; <span style={{ color }}>click · speed</span></p>
        )}
        {st === 'keyboard' && (
          <p style={S.dim}><span style={{ color }}>held</span> any key &nbsp; <span style={{ color }}>press</span> impulse</p>
        )}
        {st === 'scroll' && (
          <p style={S.dim}><span style={{ color }}>y</span> scroll pos &nbsp; <span style={{ color }}>velocity</span></p>
        )}
        {st === 'midi' && (
          <p style={S.dim}><span style={{ color }}>note · velocity · active · cc</span></p>
        )}
        {st === 'webcam' && (
          <p style={S.dim}><span style={{ color }}>brightness · r · g · b · motion</span></p>
        )}

        {st === 'constant' && (
          <SliderRow label="value" min={0} max={1} step={0.01} value={(data.value as number) ?? 0.5} color={color} onChange={(v) => set({ value: v })} />
        )}
      </div>

      {/* Output channel labels */}
      {channels.length > 1 && (
        <div style={{ position: 'absolute', right: 16, top: 0, bottom: 0, pointerEvents: 'none' }}>
          {channels.map((ch, i) => (
            <span key={ch} style={{ ...S.handleLabel, top: `calc(${handleTop(i, channels.length)} - 6px)` }}>{ch}</span>
          ))}
        </div>
      )}
    </div>
  )
})

export default SourceNode
