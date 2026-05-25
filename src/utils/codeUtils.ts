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

// ─── Popup window HTML (open-in-window + regional semantic edit) ─────────────
// The popup is opened via window.open('') + document.write so it shares the
// opener's origin and can postMessage back and forth freely. It contains:
//   • a left toolbar with the "regional edit" button
//   • the sketch iframe (using buildIframeSrcdoc)
//   • a transparent overlay layer for drawing a selection rectangle
//   • a modal dialog for entering the regional prompt
// Messages it sends to the opener:
//   { type: 'regional-edit', region: {x,y,w,h,canvasW,canvasH}, prompt: string }
// Messages it accepts from the opener:
//   { type: 'code-update', code: string, library: 'p5js'|'threejs' }
//   { type: 'generation-state', generating: boolean }

export function buildSketchPopupHtml(code: string, library: LibraryType, title: string): string {
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>${title.replace(/[<>&"]/g, '')} — sketch</title>
<style>
  *,*::before,*::after{box-sizing:border-box}
  html,body{margin:0;padding:0;height:100%;background:#080808;color:#f0f0f0;font-family:'Space Grotesk',system-ui,sans-serif;font-size:13px;overflow:hidden}
  #wrap{display:flex;height:100%}
  #toolbar{width:48px;flex-shrink:0;background:#0c0c14;border-right:1px solid #222;display:flex;flex-direction:column;align-items:center;padding:8px 0;gap:8px}
  .tool-btn{width:34px;height:34px;border-radius:6px;border:1px solid transparent;background:transparent;color:#a0a0a0;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .12s}
  .tool-btn:hover{background:#1e1e2e;color:#f0f0f0}
  .tool-btn.active{background:rgba(140,73,223,0.18);border-color:#8C49DF;color:#8C49DF}
  .tool-btn svg{width:18px;height:18px}
  #stage{flex:1;position:relative;background:#080808}
  #stage iframe{width:100%;height:100%;border:0;display:block;background:#111}
  #overlay{position:absolute;inset:0;cursor:default;pointer-events:none}
  #overlay.active{cursor:crosshair;pointer-events:auto;background:rgba(0,0,0,0.05)}
  #selrect{position:absolute;border:1.5px dashed #8C49DF;background:rgba(140,73,223,0.12);display:none;pointer-events:none}
  #status{position:absolute;top:8px;left:8px;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);padding:4px 10px;border-radius:999px;font-size:11px;color:#c084fc;display:none}
  #status.show{display:block}
  /* Dialog */
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(2px);z-index:100;display:none;align-items:center;justify-content:center}
  .modal-overlay.show{display:flex}
  .modal{background:#111118;border:1px solid #2a2a3a;border-radius:12px;width:420px;max-width:92vw;padding:18px;box-shadow:0 8px 32px rgba(0,0,0,.7)}
  .modal h3{margin:0 0 4px;font-size:14px;font-weight:600}
  .modal p{margin:0 0 14px;font-size:11px;color:#888}
  .modal textarea{width:100%;min-height:80px;background:hsl(240 11% 11%);color:#f0f0f0;border:1px solid #2a2a3a;border-radius:6px;padding:8px 10px;font-size:12px;font-family:inherit;resize:vertical;outline:none}
  .modal textarea:focus{border-color:#8C49DF}
  .modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
  .btn{padding:6px 14px;border-radius:6px;border:1px solid #2a2a3a;background:transparent;color:#a0a0a0;cursor:pointer;font-size:12px;font-family:inherit;transition:all .12s}
  .btn:hover{color:#f0f0f0;background:#1e1e2e}
  .btn-primary{background:#8C49DF;border-color:#8C49DF;color:#fff}
  .btn-primary:hover{background:#7B38CE;border-color:#7B38CE;color:#fff}
  .btn-primary:disabled{opacity:.5;cursor:not-allowed}
  #busy{position:absolute;inset:0;background:rgba(8,8,16,0.6);backdrop-filter:blur(2px);display:none;align-items:center;justify-content:center;z-index:50;color:#c084fc;font-size:12px}
  #busy.show{display:flex}
  #busy .spinner{width:14px;height:14px;border:2px solid rgba(140,73,223,0.3);border-top-color:#8C49DF;border-radius:50%;animation:sp 1s linear infinite;margin-right:8px}
  @keyframes sp{to{transform:rotate(360deg)}}
</style>
</head><body>
<div id="wrap">
  <div id="toolbar">
    <button class="tool-btn" id="btn-region" title="Regional semantic edit: drag a rectangle on the sketch, then describe what to change">
      <!-- magic-wand icon (FA-style path) -->
      <svg viewBox="0 0 576 512" fill="currentColor"><path d="M234.7 42.7L197 56.8c-3 1.1-5 4-5 7.2s2 6.1 5 7.2l37.7 14.1L248.8 123c1.1 3 4 5 7.2 5s6.1-2 7.2-5l14.1-37.7L315 71.2c3-1.1 5-4 5-7.2s-2-6.1-5-7.2L277.3 42.7 263.2 5c-1.1-3-4-5-7.2-5s-6.1 2-7.2 5L234.7 42.7zM46.1 395.4c-18.7 18.7-18.7 49.1 0 67.9l34.6 34.6c18.7 18.7 49.1 18.7 67.9 0L529.9 116.5c18.7-18.7 18.7-49.1 0-67.9L495.3 14.1c-18.7-18.7-49.1-18.7-67.9 0L46.1 395.4zM484.6 82.6l-105 105-23.3-23.3 105-105 23.3 23.3z"/></svg>
    </button>
  </div>
  <div id="stage">
    <iframe id="sketch" sandbox="allow-scripts"></iframe>
    <div id="overlay"><div id="selrect"></div></div>
    <div id="status">Drag to select a region…</div>
    <div id="busy"><span class="spinner"></span>Re-generating region…</div>
  </div>
</div>
<div class="modal-overlay" id="modal-overlay">
  <div class="modal">
    <h3>Regional semantic edit</h3>
    <p id="region-info">Selected region</p>
    <textarea id="prompt-input" placeholder="e.g. make the elements in this area more chaotic, or change to warm colors…" autofocus></textarea>
    <div class="modal-actions">
      <button class="btn" id="btn-cancel">Cancel</button>
      <button class="btn btn-primary" id="btn-submit">Apply edit</button>
    </div>
  </div>
</div>
<script>
(function(){
  var iframe = document.getElementById('sketch');
  var overlay = document.getElementById('overlay');
  var selRect = document.getElementById('selrect');
  var status  = document.getElementById('status');
  var busy    = document.getElementById('busy');
  var btnRegion = document.getElementById('btn-region');
  var modalOv = document.getElementById('modal-overlay');
  var promptInput = document.getElementById('prompt-input');
  var btnCancel = document.getElementById('btn-cancel');
  var btnSubmit = document.getElementById('btn-submit');
  var regionInfo = document.getElementById('region-info');

  var currentCode = ${JSON.stringify(code)};
  var currentLibrary = ${JSON.stringify(library)};
  function loadSketch(){
    // Rebuild iframe content using the latest currentCode (mirrors buildIframeSrcdoc)
    if (currentLibrary === 'p5js') {
      iframe.srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8">'
        + '<style>html,body{margin:0;padding:0;overflow:hidden;background:#111}canvas{display:block}</style>'
        + '<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.0/p5.min.js"><'+'/script>'
        + '</head><body><script>'
        + 'window.addEventListener("message",function(e){if(e.data==="pause"&&typeof noLoop==="function")noLoop();if(e.data==="resume"&&typeof loop==="function")loop();if(e.data==="reset")window.location.reload();});'
        + currentCode
        + '<'+'/script></body></html>';
    } else {
      iframe.srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8">'
        + '<style>html,body{margin:0;padding:0;overflow:hidden;background:#050510}canvas{display:block}</style>'
        + '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js"><'+'/script>'
        + '</head><body><script>'
        + 'let _paused=false;window.addEventListener("message",function(e){if(e.data==="pause")_paused=true;if(e.data==="resume")_paused=false;if(e.data==="reset")window.location.reload();});'
        + 'const _raf=window.requestAnimationFrame;window.requestAnimationFrame=function(cb){return _raf(function(t){if(!_paused)cb(t);else _raf(arguments.callee);});};'
        + currentCode
        + '<'+'/script></body></html>';
    }
  }
  loadSketch();

  // ── Region select mode ──
  var selectMode = false;
  var dragging = false;
  var startX = 0, startY = 0;
  var lastRect = null;

  function setMode(on){
    selectMode = on;
    if (on) { overlay.classList.add('active'); status.classList.add('show'); btnRegion.classList.add('active'); }
    else    { overlay.classList.remove('active'); status.classList.remove('show'); btnRegion.classList.remove('active'); selRect.style.display = 'none'; }
  }

  btnRegion.addEventListener('click', function(){ setMode(!selectMode); });

  overlay.addEventListener('mousedown', function(e){
    if (!selectMode) return;
    var r = overlay.getBoundingClientRect();
    dragging = true;
    startX = e.clientX - r.left;
    startY = e.clientY - r.top;
    selRect.style.left = startX + 'px';
    selRect.style.top  = startY + 'px';
    selRect.style.width = '0px';
    selRect.style.height = '0px';
    selRect.style.display = 'block';
  });
  overlay.addEventListener('mousemove', function(e){
    if (!dragging) return;
    var r = overlay.getBoundingClientRect();
    var x = e.clientX - r.left;
    var y = e.clientY - r.top;
    var left = Math.min(x, startX);
    var top  = Math.min(y, startY);
    var w = Math.abs(x - startX);
    var h = Math.abs(y - startY);
    selRect.style.left = left + 'px';
    selRect.style.top  = top  + 'px';
    selRect.style.width = w + 'px';
    selRect.style.height = h + 'px';
  });
  overlay.addEventListener('mouseup', function(e){
    if (!dragging) return;
    dragging = false;
    var r = overlay.getBoundingClientRect();
    var x = e.clientX - r.left;
    var y = e.clientY - r.top;
    var left = Math.min(x, startX);
    var top  = Math.min(y, startY);
    var w = Math.abs(x - startX);
    var h = Math.abs(y - startY);
    if (w < 8 || h < 8) { selRect.style.display = 'none'; return; }
    lastRect = { x: left, y: top, w: w, h: h, canvasW: r.width, canvasH: r.height };
    regionInfo.textContent = 'Region: ' + w.toFixed(0) + '×' + h.toFixed(0) +
      'px at (' + left.toFixed(0) + ', ' + top.toFixed(0) + ') of ' +
      r.width.toFixed(0) + '×' + r.height.toFixed(0) + 'px canvas';
    modalOv.classList.add('show');
    setTimeout(function(){ promptInput.focus(); }, 50);
  });

  // Dialog actions
  function closeDialog(){ modalOv.classList.remove('show'); promptInput.value = ''; }
  btnCancel.addEventListener('click', function(){ closeDialog(); setMode(false); selRect.style.display='none'; });
  btnSubmit.addEventListener('click', function(){
    var p = promptInput.value.trim();
    if (!p || !lastRect) return;
    closeDialog();
    setMode(false);
    busy.classList.add('show');
    window.opener && window.opener.postMessage({
      type: 'regional-edit',
      region: lastRect,
      prompt: p
    }, '*');
  });
  // Ctrl/Cmd+Enter in textarea submits
  promptInput.addEventListener('keydown', function(e){
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); btnSubmit.click(); }
    if (e.key === 'Escape') { btnCancel.click(); }
  });

  // ── Receive code updates from the opener ──
  window.addEventListener('message', function(e){
    var d = e.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'code-update' && typeof d.code === 'string') {
      currentCode = d.code;
      if (d.library) currentLibrary = d.library;
      loadSketch();
      busy.classList.remove('show');
    } else if (d.type === 'generation-state') {
      if (d.generating) busy.classList.add('show'); else busy.classList.remove('show');
    } else if (d.type === 'generation-error') {
      busy.classList.remove('show');
      alert('Regional edit failed: ' + (d.message || 'unknown error'));
    }
  });
})();
</script>
</body></html>`
}

// ─── Code extraction ──────────────────────────────────────────────────────────

export function extractCodeFromResponse(text: string): string {
  const fenced = text.match(/```(?:javascript|js|p5|threejs)?\n?([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  return text.trim()
}
