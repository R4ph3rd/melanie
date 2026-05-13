import type { Parameter, LibraryType } from './types'

// Extract global numeric variables from p5.js or three.js code
export function extractParameters(code: string): Parameter[] {
  const params: Parameter[] = []
  const seen = new Set<string>()
  // Match top-level let/var/const declarations with numeric literal
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
      min = raw * 3; max = Math.abs(raw)
    } else {
      min = 0; max = raw * 4 || 10
    }
    params.push({
      name,
      label: camelToLabel(name),
      value: raw,
      min: isInt ? Math.round(min) : +min.toFixed(2),
      max: isInt ? Math.round(max) : +max.toFixed(2),
      step,
    })
  }
  return params
}

function camelToLabel(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .replace(/_/g, ' ')
    .trim()
}

// Replace a named variable's value in the code
export function updateParameterInCode(code: string, name: string, value: number): string {
  const re = new RegExp(
    `((?:^|(?<=\\n))(?:let|var|const)\\s+${escapeRegex(name)}\\s*=\\s*)[-\\d.]+`,
    'gm'
  )
  return code.replace(re, `$1${value}`)
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Build the srcdoc HTML for the sketch iframe
export function buildIframeSrcdoc(code: string, library: LibraryType): string {
  if (library === 'p5js') {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; overflow: hidden; background: #111; }
  canvas { display: block; }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.0/p5.min.js"></script>
</head>
<body>
<script>
(function() {
  let _paused = false;
  window.addEventListener('message', function(e) {
    if (e.data === 'pause')  { _paused = true; }
    if (e.data === 'resume') { _paused = false; }
    if (e.data === 'reset')  { window.location.reload(); }
  });
  const _origDraw = window.draw;
  // Patch p5 loop via noLoop/loop after setup
  window.addEventListener('p5jsReady', function() {
    const _origDraw2 = window.draw;
    if (_origDraw2) {
      window.draw = function() {
        if (!_paused) _origDraw2();
      };
    }
  });
})();

${code}
</script>
</body>
</html>`
  }

  // three.js
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; overflow: hidden; background: #050510; }
  canvas { display: block; }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js"></script>
</head>
<body>
<script>
let _paused = false;
window.addEventListener('message', function(e) {
  if (e.data === 'pause')  _paused = true;
  if (e.data === 'resume') _paused = false;
  if (e.data === 'reset')  window.location.reload();
});

const _raf = window.requestAnimationFrame;
window.requestAnimationFrame = function(cb) {
  return _raf(function(t) { if (!_paused) cb(t); else _raf(arguments.callee); });
};

${code}
</script>
</body>
</html>`
}

// Strip markdown code fences from LLM response
export function extractCodeFromResponse(text: string): string {
  // Remove ```javascript ... ``` or ``` ... ``` blocks
  const fenced = text.match(/```(?:javascript|js|p5|threejs)?\n?([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  return text.trim()
}
