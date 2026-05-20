import type { LibraryType, OperatorType } from '../utils/types'

const BASE_RESTRICTIONS = `
Restrictions:
- Only respond with code as a raw string. No markdown, no backticks, no explanation.
- The code must be complete and runnable as-is.
- Be as efficient as possible with your implementations.
- When producing computationally intensive sketches, use optimization methods.
- Always include animation (use draw() loop for p5.js, requestAnimationFrame for three.js).
- Comment your code with brief useful comments.
`.trim()

const P5_SYSTEM = `You are a creative coding software engineer specialized in p5.js.
You create visually stunning, animated generative art using p5.js.
You excel at: creating sketches from natural language, modifying existing sketches,
blending multiple sketches semantically, and building interactive art.

${BASE_RESTRICTIONS}

Canvas size: use createCanvas(460, 400) unless the code already defines a different size.
Global variables for parameters should be declared at the top of the file.`

const THREEJS_SYSTEM = `You are a creative coding software engineer specialized in three.js.
You create visually stunning 3D animated scenes using three.js r134.
The scene renderer should be sized 460×400. Always create a scene, camera, WebGLRenderer,
and an animation loop using requestAnimationFrame.

${BASE_RESTRICTIONS}

Do not import or require, three.js is already available as the global THREE.`

export function getModifySystem(library: LibraryType): string {
  return library === 'p5js' ? P5_SYSTEM : THREEJS_SYSTEM
}

export function getMergeSystem(library: LibraryType): string {
  const base = library === 'p5js' ? P5_SYSTEM : THREEJS_SYSTEM
  return `${base}

You will receive two code snippets and merge them into a single sketch that combines
the visual identity and behaviour of both in a semantically meaningful way.
Begin your response with a merge description comment:
/* Merge: combine [feature A] from Snippet 1 with [feature B] from Snippet 2 */`
}

export function getDiffSystem(): string {
  return `You are a creative coding assistant. Compare two code snippets.
In 2-4 sentences, describe how they differ visually and in code structure.
Focus on visual output differences, not syntax details. Be concise.`
}

export function getAutocompleteSystem(): string {
  return `You are an autocomplete engine for a creative coding natural-language prompt editor.
When given a partial or complete prompt, return exactly 3 diverse, creative continuations or alternatives.
Respond ONLY with a JSON array of 3 strings. No other text. Example:
["suggestion one", "suggestion two", "suggestion three"]`
}

export function getExtractSystem(library: LibraryType): string {
  const base = library === 'p5js' ? P5_SYSTEM : THREEJS_SYSTEM
  return `${base}

You will extract a specific visual property or behaviour from the source sketch
and create a new standalone sketch focused on that extracted aspect.`
}

// Dynamic context builders

export function buildModifyMessages(
  sourceCode: string,
  prompt: string,
  library: LibraryType,
) {
  const libName = library === 'p5js' ? 'p5.js' : 'three.js'
  return [
    {
      role: 'user' as const,
      content: `Here is the source ${libName} sketch:\n\n${sourceCode}\n\nModification request: ${prompt}`,
    },
  ]
}

export function buildMergeMessages(code1: string, code2: string) {
  return [
    {
      role: 'user' as const,
      content: `Snippet 1:\n\`\`\`\n${code1}\n\`\`\`\n\nSnippet 2:\n\`\`\`\n${code2}\n\`\`\`\n\nMerge these two sketches into one.`,
    },
  ]
}

export function buildDiffMessages(code1: string, code2: string, title1: string, title2: string) {
  return [
    {
      role: 'user' as const,
      content: `Sketch A (${title1}):\n\`\`\`\n${code1}\n\`\`\`\n\nSketch B (${title2}):\n\`\`\`\n${code2}\n\`\`\`\n\nDescribe the differences.`,
    },
  ]
}

export function buildExtractMessages(sourceCode: string, prompt: string, library: LibraryType) {
  const libName = library === 'p5js' ? 'p5.js' : 'three.js'
  return [
    {
      role: 'user' as const,
      content: `Source ${libName} sketch:\n\n${sourceCode}\n\nExtract and isolate: ${prompt}`,
    },
  ]
}

export function buildAutocompleteMessages(
  partialPrompt: string,
  sourceCode: string,
) {
  return [
    {
      role: 'user' as const,
      content: `Source sketch context:\n${sourceCode.slice(0, 600)}\n\nPartial prompt: "${partialPrompt}"\n\nProvide 3 diverse autocomplete suggestions as a JSON array.`,
    },
  ]
}

// ─── Semantic label enrichment ────────────────────────────────────────────────

export function getSemanticLabelSystem(): string {
  return `You map creative coding variable names to short semantic labels that describe their visual effect.
Given a list of variable names and the sketch's source prompt, return a JSON object mapping each variable name to a concise label (2-5 words) describing what adjusting it changes visually.
Examples: {"circleSize": "ring diameter", "numRings": "number of rings", "bgBrightness": "background glow", "strokeW": "outline thickness"}
Respond ONLY with valid JSON — no markdown, no explanation, no extra keys.`
}

export function buildSemanticLabelMessages(
  varNames: string[],
  sourcePrompt: string,
  codeExcerpt: string,
): { role: 'user' | 'assistant'; content: string }[] {
  return [
    {
      role: 'user' as const,
      content: `Sketch prompt: "${sourcePrompt}"

Variable names: ${JSON.stringify(varNames)}

Code excerpt:
${codeExcerpt.slice(0, 500)}

Return a JSON object mapping each variable name to a short semantic label describing its visual effect.`,
    },
  ]
}

// ─── Param-transfer operator ──────────────────────────────────────────────────

export function buildParamTransferMessages(
  targetCode: string,
  paramName: string,
  paramLabel: string,
  paramValue: number,
  sourceCode: string,
  library: LibraryType,
): { role: 'user' | 'assistant'; content: string }[] {
  const libName = library === 'p5js' ? 'p5.js' : 'three.js'
  return [
    {
      role: 'user' as const,
      content: `Here is the target ${libName} sketch:

${targetCode}

From another sketch, the user wants to incorporate this parameter:
- Variable name: ${paramName}
- Semantic meaning: "${paramLabel}"
- Current value: ${paramValue}

Source sketch (for context on how the parameter is used):
${sourceCode.slice(0, 600)}

Modify the target sketch to incorporate this concept meaningfully. The parameter should control something visually equivalent or complementary. Declare the variable at the top and use it appropriately.`,
    },
  ]
}

// ─── Semantic / latent axes ("Photoshop knobs") ───────────────────────────────

export function getSemanticAxesSystem(): string {
  return `You analyse generative-art sketches and propose 3-4 SEMANTIC axes the artist
could explore — high-level aesthetic dimensions, NOT code variables. Each axis has two
opposing poles (e.g. "chaos" vs "order", "biological" vs "mechanical", "dense" vs
"sparse", "warm" vs "cold", "minimal" vs "maximal").

Choose axes that are SPECIFIC to the given sketch (avoid generic suggestions when the
sketch suggests something more interesting). For each axis, write a concise (1 short
sentence) prompt fragment describing what each pole would look like for THIS sketch.

Respond ONLY with valid JSON, no markdown, no commentary, in this exact shape:
[
  {
    "leftLabel":   "chaos",
    "rightLabel":  "order",
    "leftPrompt":  "Overlapping shapes scattered randomly, jittery motion, broken symmetry.",
    "rightPrompt": "Perfectly aligned grid, harmonic spacing, mirror symmetry, deliberate timing."
  },
  ...
]`
}

export function buildSemanticAxesMessages(
  code: string,
  library: LibraryType,
  sourcePrompt?: string,
) {
  const libName = library === 'p5js' ? 'p5.js' : 'three.js'
  return [
    {
      role: 'user' as const,
      content:
        `${libName} sketch:\n\n${code}\n\n` +
        (sourcePrompt ? `Original intent: "${sourcePrompt}"\n\n` : '') +
        `Propose 3-4 semantic axes the artist could scrub to explore variants of THIS sketch.`,
    },
  ]
}

export function getAxisScrubSystem(library: LibraryType): string {
  const base = library === 'p5js' ? P5_SYSTEM : THREEJS_SYSTEM
  return `${base}

You will receive a BASELINE sketch and a set of semantic-axis values the artist has
scrubbed to. Each axis sits between two opposing poles. Re-write the sketch so its
aesthetics shift to match the requested axis values, blending the pole descriptions
proportionally. Preserve the sketch's core idea (its subject matter and overall
structure); only the aesthetics — shapes, motion, density, colour, mood — should
move along the requested axes. Output the FULL updated sketch code.`
}

export function buildAxisScrubMessages(
  baselineCode: string,
  axes: { leftLabel: string; rightLabel: string; leftPrompt: string; rightPrompt: string; value: number }[],
  library: LibraryType,
) {
  const libName = library === 'p5js' ? 'p5.js' : 'three.js'
  const axisLines = axes.map((a) => {
    const pctRight = Math.round(a.value * 100)
    const pctLeft  = 100 - pctRight
    return (
      `• "${a.leftLabel}" ↔ "${a.rightLabel}" — at ${pctLeft}% / ${pctRight}%\n` +
      `    left pole:  ${a.leftPrompt}\n` +
      `    right pole: ${a.rightPrompt}`
    )
  }).join('\n')
  return [
    {
      role: 'user' as const,
      content:
        `Baseline ${libName} sketch:\n\n${baselineCode}\n\n` +
        `Re-generate the sketch with these axis positions:\n${axisLines}\n\n` +
        `Output the full updated code. Keep the subject; shift the aesthetics.`,
    },
  ]
}

// ─── Regional / in-place semantic edit ────────────────────────────────────────

export function getRegionalEditSystem(library: LibraryType): string {
  const base = library === 'p5js' ? P5_SYSTEM : THREEJS_SYSTEM
  return `${base}

You will receive a sketch and a user request that applies to a SPECIFIC rectangular
region of the rendered canvas. Identify which drawing commands fall inside that
region (using their coordinates relative to the canvas size) and modify ONLY those
commands. Keep everything outside the region byte-for-byte identical wherever
possible. Output the FULL updated sketch code, not a diff.`
}

export function buildRegionalEditMessages(
  sourceCode: string,
  prompt: string,
  region: { x: number; y: number; w: number; h: number; canvasW: number; canvasH: number },
  library: LibraryType,
) {
  const libName = library === 'p5js' ? 'p5.js' : 'three.js'
  const xPct = ((region.x / region.canvasW) * 100).toFixed(1)
  const yPct = ((region.y / region.canvasH) * 100).toFixed(1)
  const wPct = ((region.w / region.canvasW) * 100).toFixed(1)
  const hPct = ((region.h / region.canvasH) * 100).toFixed(1)
  return [
    {
      role: 'user' as const,
      content:
        `Source ${libName} sketch:\n\n${sourceCode}\n\n` +
        `Regional edit request: "${prompt}"\n\n` +
        `Apply this change ONLY to visual elements inside the rectangle:\n` +
        `  top-left:  (${region.x.toFixed(0)}px, ${region.y.toFixed(0)}px) ≈ (${xPct}%, ${yPct}%)\n` +
        `  size:      ${region.w.toFixed(0)}px × ${region.h.toFixed(0)}px (${wPct}% × ${hPct}%)\n` +
        `  canvas:    ${region.canvasW}px × ${region.canvasH}px\n\n` +
        `Leave everything outside this region visually unchanged. Output the full updated code.`,
    },
  ]
}

export function getSystemForOperator(op: OperatorType, library: LibraryType): string {
  switch (op) {
    case 'modify':    return getModifySystem(library)
    case 'merge':     return getMergeSystem(library)
    case 'diff':      return getDiffSystem()
    case 'extract':   return getExtractSystem(library)
    case 'duplicate': return getModifySystem(library)
  }
}
