import type { Parameter, LibraryType } from './types'

// ─── Parameter extraction ─────────────────────────────────────────────────────

export function extractParameters(code: string): Parameter[] {
  const params: Parameter[] = []
  const seen = new Set<string>()
  const re = /^(?:let|var|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*([-\d.]+)\s*;/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(code)) !== null) {
    const name = m[1]
    const raw  = parseFloat(m[2])
    if (isNaN(raw) || seen.has(name)) continue
    seen.add(name)
    const isInt = Number.isInteger(raw)
    const step  = isInt ? 1 : 0.01
    const abs   = Math.abs(raw)
    let min: number, max: number
    if (abs === 0) {
      min = -50; max = 50
    } else if (raw < 0) {
      // Negative: allow going 3× more negative, up to positive mirror
      min = raw * 3; max = Math.abs(raw)
    } else {
      min = 0
      // Scale factor shrinks for large values to keep the range usable
      const factor = raw > 500 ? 1.5 : raw > 100 ? 2 : raw > 10 ? 3 : 4
      max = raw * factor || 10
    }
    const label = smartLabel(name)
    params.push({
      name,
      label,
      semanticLabel: label,   // enriched asynchronously later
      value: raw,
      min:  isInt ? Math.round(min)  : +min.toFixed(2),
      max:  isInt ? Math.round(max)  : +max.toFixed(2),
      step,
    })
  }
  return params
}

/**
 * Convert camelCase/snake_case variable names to readable labels.
 * Uses domain vocabulary common in creative coding contexts.
 */
function smartLabel(name: string): string {
  // Known shorthand expansions
  const expansions: Record<string, string> = {
    num: 'Number of', n: 'Count', sz: 'Size', w: 'Width', h: 'Height',
    r: 'Radius', col: 'Color', clr: 'Color', bg: 'Background',
    spd: 'Speed', vel: 'Velocity', acc: 'Acceleration', freq: 'Frequency',
    amp: 'Amplitude', ang: 'Angle', rot: 'Rotation', scl: 'Scale',
    str: 'Strength', wt: 'Weight', sw: 'Stroke Width',
    lw: 'Line Width', fw: 'Fill Weight',
    min: 'Minimum', max: 'Maximum', off: 'Offset',
  }
  // Split camelCase and snake_case
  const parts = name
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
  const expanded = parts.map((p, i) => {
    const lower = p.toLowerCase()
    const exp = expansions[lower]
    if (exp) return i === 0 ? exp : exp.toLowerCase()
    return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
  })
  return expanded.join(' ')
}

/**
 * Apply semantic labels from an LLM-generated map back to the extracted params.
 * Called asynchronously after code generation.
 */
export function applySemanticLabels(
  params: Parameter[],
  labelMap: Record<string, string>,
): Parameter[] {
  return params.map(p => ({
    ...p,
    semanticLabel: labelMap[p.name] ?? p.semanticLabel,
  }))
}

// ─── Code manipulation ────────────────────────────────────────────────────────

export function updateParameterInCode(code: string, name: string, value: number): string {
  const re = new RegExp(
    `((?:^|(?<=\\n))(?:let|var|const)\\s+${escapeRegex(name)}\\s*=\\s*)[-\\d.]+`,
    'gm',
  )
  return code.replace(re, `$1${value}`)
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ─── iframe srcdoc builder ────────────────────────────────────────────────────

export function buildIframeSrcdoc(code: string, library: LibraryType): string {
  if (library === 'p5js') {
    return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<style>html,body{margin:0;padding:0;overflow:hidden;background:#111}canvas{display:block}</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.0/p5.min.js"></script>
</head><body>
<script>
window.addEventListener('message',function(e){
  if(e.data==='pause'&&typeof noLoop==='function')noLoop();
  if(e.data==='resume'&&typeof loop==='function')loop();
  if(e.data==='reset')window.location.reload();
});
${code}
</script></body></html>`
  }
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<style>html,body{margin:0;padding:0;overflow:hidden;background:#050510}canvas{display:block}</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js"></script>
</head><body>
<script>
let _paused=false;
window.addEventListener('message',function(e){
  if(e.data==='pause')_paused=true;
  if(e.data==='resume')_paused=false;
  if(e.data==='reset')window.location.reload();
});
const _raf=window.requestAnimationFrame;
window.requestAnimationFrame=function(cb){
  return _raf(function(t){if(!_paused)cb(t);else _raf(arguments.callee);});
};
${code}
</script></body></html>`
}

// ─── Code extraction ──────────────────────────────────────────────────────────

export function extractCodeFromResponse(text: string): string {
  const fenced = text.match(/```(?:javascript|js|p5|threejs)?\n?([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  return text.trim()
}
