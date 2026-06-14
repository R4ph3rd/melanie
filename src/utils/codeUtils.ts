import type { Parameter, LibraryType } from './types'

// ─── Parameter extraction ─────────────────────────────────────────────────────

export function extractParameters(code: string): Parameter[] {
  const params: Parameter[] = []
  const seen = new Set<string>()

  // Color literals: top-level `let/var/const name = '#rgb'|'#rrggbb'` → swatch control.
  const colorRe = /^(?:let|var|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*['"](#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}))['"]\s*;/gm
  let cm: RegExpExecArray | null
  while ((cm = colorRe.exec(code)) !== null) {
    const name = cm[1]
    if (seen.has(name)) continue
    seen.add(name)
    const label = smartLabel(name)
    params.push({ name, label, semanticLabel: label, value: 0, min: 0, max: 0, step: 0, kind: 'color', colorValue: cm[2] })
  }

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
      kind: 'number',
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

// Rewrite a numeric parameter's declaration value. Anchored to the declaration
// line (start-of-line + let/var/const + name), so identical numbers elsewhere —
// in comments, strings, or expressions — are never touched.
export function updateParameterInCode(code: string, name: string, value: number): string {
  const re = new RegExp(
    `((?:^|(?<=\\n))(?:let|var|const)\\s+${escapeRegex(name)}\\s*=\\s*)[-\\d.]+`,
    'gm',
  )
  return code.replace(re, `$1${value}`)
}

// Rewrite a color parameter's hex literal, preserving the original quote style.
export function updateColorParameterInCode(code: string, name: string, hex: string): string {
  const re = new RegExp(
    `((?:^|(?<=\\n))(?:let|var|const)\\s+${escapeRegex(name)}\\s*=\\s*)(['"])#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\2`,
    'gm',
  )
  return code.replace(re, `$1$2${hex}$2`)
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ─── iframe srcdoc builder ────────────────────────────────────────────────────

// Promote let/const param declarations to var so they're window-accessible for
// live-var updates. Matches the declaration head only (name =), so it works for
// both numeric and color (string) parameters.
function promoteParamVars(code: string, params: Parameter[]): string {
  let out = code
  for (const p of params) {
    out = out.replace(
      new RegExp(`\\b(?:let|const)(\\s+${escapeRegex(p.name)}\\s*=)`, 'm'),
      'var$1',
    )
  }
  return out
}

export function buildIframeSrcdoc(code: string, library: LibraryType, nodeId?: string): string {
  const params      = extractParameters(code)
  const patchedCode = promoteParamVars(code, params)
  // output(channel, value) lets sketches push scalar signals to the graph.
  const outputFn    = nodeId
    ? `window.output=function(ch,v){parent.postMessage({type:'sketch-output',nodeId:${JSON.stringify(nodeId)},channel:ch,value:+v},'*')};`
    : 'window.output=function(){};'

  // Feedback wiring: respond to capture requests with the current canvas as an
  // ImageBitmap, and accept incoming frames as window.feedbackFrame.
  const frameMsgs = nodeId ? `
  if(d&&typeof d==='object'&&d.type==='request-frame'){var _c=document.querySelector('canvas');if(_c&&window.createImageBitmap){createImageBitmap(_c).then(function(b){parent.postMessage({type:'sketch-frame',nodeId:${JSON.stringify(nodeId)},bitmap:b},'*',[b])}).catch(function(){})}return}
  if(d&&typeof d==='object'&&d.type==='feedback-frame'){if(window.feedbackFrame&&window.feedbackFrame.close)window.feedbackFrame.close();window.feedbackFrame=d.bitmap;return}` : ''

  if (library === 'p5js') {
    return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<style>html,body{margin:0;padding:0;overflow:hidden;background:#111}canvas{display:block}</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.0/p5.min.js"></script>
</head><body>
<script>
${outputFn}
window.addEventListener('message',function(e){
  var d=e.data;
  if(d==='pause'&&typeof noLoop==='function'){noLoop();return}
  if(d==='resume'&&typeof loop==='function'){loop();return}
  if(d==='reset'){window.location.reload();return}${frameMsgs}
  if(d&&typeof d==='object'&&d.type==='live-var'&&d.name in window)window[d.name]=d.value;
});
${patchedCode}
</script></body></html>`
  }
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<style>html,body{margin:0;padding:0;overflow:hidden;background:#050510}canvas{display:block}</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js"></script>
</head><body>
<script>
${outputFn}
var _paused=false;
window.addEventListener('message',function(e){
  var d=e.data;
  if(d==='pause'){_paused=true;return}
  if(d==='resume'){_paused=false;return}
  if(d==='reset'){window.location.reload();return}${frameMsgs}
  if(d&&typeof d==='object'&&d.type==='live-var'&&d.name in window)window[d.name]=d.value;
});
const _raf=window.requestAnimationFrame;
window.requestAnimationFrame=function(cb){
  return _raf(function(t){if(!_paused)cb(t);else _raf(arguments.callee);});
};
${patchedCode}
</script></body></html>`
}

// ─── Output channel discovery ─────────────────────────────────────────────────

// Names a sketch publishes via output('channel', value) — the data it can feed
// to another sketch. Scanned statically so the names show before the sketch runs.
export function extractOutputChannels(code: string): string[] {
  const re = /\boutput\s*\(\s*['"]([a-zA-Z_$][\w$]*)['"]/g
  const out: string[] = []
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(code)) !== null) {
    if (!seen.has(m[1])) { seen.add(m[1]); out.push(m[1]) }
  }
  return out
}

// Like extractOutputChannels but ignores one-time functions (setup/preload/init).
// The remaining output() calls are inside animation loops — genuinely dynamic.
export function extractDynamicOutputs(code: string): string[] {
  // Replace bodies of known setup-only functions with whitespace to preserve offsets.
  let stripped = code
  for (const fn of ['setup', 'preload', 'init', 'initScene']) {
    const pattern = new RegExp(`\\bfunction\\s+${fn}\\s*\\([^)]*\\)\\s*\\{`, 'g')
    let m: RegExpExecArray | null
    while ((m = pattern.exec(code)) !== null) {
      const openAt = code.indexOf('{', m.index + m[0].length - 1)
      let depth = 1; let i = openAt + 1
      while (i < code.length && depth > 0) {
        if (code[i] === '{') depth++; else if (code[i] === '}') depth--; i++
      }
      stripped = stripped.slice(0, openAt) + ' '.repeat(i - 1 - openAt) + stripped.slice(i - 1)
    }
  }
  return extractOutputChannels(stripped)
}

// ─── Code extraction ──────────────────────────────────────────────────────────

export function extractCodeFromResponse(text: string): string {
  const fenced = text.match(/```(?:javascript|js|p5|threejs)?\n?([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  return text.trim()
}
