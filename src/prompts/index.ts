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

export function getSystemForOperator(op: OperatorType, library: LibraryType): string {
  switch (op) {
    case 'modify':    return getModifySystem(library)
    case 'merge':     return getMergeSystem(library)
    case 'diff':      return getDiffSystem()
    case 'extract':   return getExtractSystem(library)
    case 'duplicate': return getModifySystem(library)
  }
}
