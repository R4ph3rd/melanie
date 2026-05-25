/**
 * Provider-agnostic LLM API layer.
 * Supports Anthropic, OpenAI, Google (Gemini) and Mistral.
 * All providers expose the same interface so the rest of the app is model-agnostic.
 */
import Anthropic from '@anthropic-ai/sdk'
import { extractCodeFromResponse } from '../utils/codeUtils'

// ─── Provider definitions ────────────────────────────────────────────────────

export interface ModelDef {
  id: string
  label: string
  maxTokens: number
}

export interface ProviderDef {
  id: string
  name: string
  logoUrl: string   // public URL or base64
  models: ModelDef[]
  keyPrefix: string // expected prefix of API keys (for quick validation hint)
  docsUrl: string
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    logoUrl: 'https://www.google.com/s2/favicons?domain=anthropic.com&sz=64',
    keyPrefix: 'sk-ant-',
    docsUrl: 'https://console.anthropic.com/keys',
    models: [
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',  maxTokens: 4096 },
      { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6', maxTokens: 8192 },
      { id: 'claude-opus-4-5',           label: 'Claude Opus 4.5',   maxTokens: 8192 },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    logoUrl: 'https://www.google.com/s2/favicons?domain=openai.com&sz=64',
    keyPrefix: 'sk-',
    docsUrl: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini',  maxTokens: 4096 },
      { id: 'gpt-4o',      label: 'GPT-4o',        maxTokens: 8192 },
      { id: 'o4-mini',     label: 'o4-mini',       maxTokens: 8192 },
    ],
  },
  {
    id: 'google',
    name: 'Google Gemini',
    logoUrl: 'https://www.google.com/s2/favicons?domain=gemini.google.com&sz=64',
    keyPrefix: 'AIza',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    models: [
      { id: 'gemini-2.0-flash',      label: 'Gemini 2.0 Flash',   maxTokens: 4096 },
      { id: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash Preview', maxTokens: 8192 },
      { id: 'gemini-2.5-pro-preview-06-05',   label: 'Gemini 2.5 Pro Preview',   maxTokens: 8192 },
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral',
    logoUrl: 'https://www.google.com/s2/favicons?domain=mistral.ai&sz=64',
    keyPrefix: '',
    docsUrl: 'https://console.mistral.ai/api-keys',
    models: [
      { id: 'mistral-small-latest',  label: 'Mistral Small',  maxTokens: 4096 },
      { id: 'mistral-medium-latest', label: 'Mistral Medium', maxTokens: 4096 },
      { id: 'mistral-large-latest',  label: 'Mistral Large',  maxTokens: 4096 },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    logoUrl: 'https://www.google.com/s2/favicons?domain=groq.com&sz=64',
    keyPrefix: 'gsk_',
    docsUrl: 'https://console.groq.com/keys',
    models: [
      { id: 'llama-3.3-70b-versatile',  label: 'Llama 3.3 70B',       maxTokens: 8192 },
      { id: 'llama-3.1-8b-instant',     label: 'Llama 3.1 8B Instant', maxTokens: 8192 },
      { id: 'gemma2-9b-it',             label: 'Gemma 2 9B',           maxTokens: 8192 },
      { id: 'mixtral-8x7b-32768',       label: 'Mixtral 8×7B',         maxTokens: 4096 },
    ],
  },
]

export function getProvider(id: string) {
  return PROVIDERS.find(p => p.id === id)
}

export function getModel(providerId: string, modelId: string) {
  return getProvider(providerId)?.models.find(m => m.id === modelId)
}

export function defaultProviderAndModel(): { providerId: string; modelId: string } {
  return { providerId: 'anthropic', modelId: 'claude-haiku-4-5-20251001' }
}

// ─── Unified generate call ───────────────────────────────────────────────────

export interface GenerateOpts {
  providerId: string
  apiKey: string
  modelId: string
  system: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  maxTokens?: number
  onStream?: (partial: string) => void
}

export async function generate(opts: GenerateOpts): Promise<string> {
  const { providerId, apiKey, modelId, system, messages, maxTokens = 2048, onStream } = opts
  switch (providerId) {
    case 'anthropic': return callAnthropic(apiKey, modelId, system, messages, maxTokens, onStream)
    case 'openai':    return callOpenAI(apiKey, modelId, system, messages, maxTokens, onStream)
    case 'google':    return callGoogle(apiKey, modelId, system, messages, maxTokens, onStream)
    case 'mistral':   return callMistral(apiKey, modelId, system, messages, maxTokens, onStream)
    case 'groq':      return callGroq(apiKey, modelId, system, messages, maxTokens, onStream)
    default: throw new Error(`Unknown provider: ${providerId}`)
  }
}

// ─── Anthropic ───────────────────────────────────────────────────────────────

async function callAnthropic(
  apiKey: string, modelId: string, system: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  maxTokens: number, onStream?: (p: string) => void,
): Promise<string> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  if (onStream) {
    let full = ''
    const stream = client.messages.stream({ model: modelId, max_tokens: maxTokens, system, messages })
    for await (const ev of stream) {
      if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
        full += ev.delta.text
        onStream(extractCodeFromResponse(full))
      }
    }
    return extractCodeFromResponse(full)
  }
  const resp = await client.messages.create({ model: modelId, max_tokens: maxTokens, system, messages })
  const text = resp.content[0].type === 'text' ? resp.content[0].text : ''
  return extractCodeFromResponse(text)
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────

async function callOpenAI(
  apiKey: string, modelId: string, system: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  maxTokens: number, onStream?: (p: string) => void,
): Promise<string> {
  const body = {
    model: modelId,
    max_tokens: maxTokens,
    stream: !!onStream,
    messages: [{ role: 'system', content: system }, ...messages],
  }
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(`OpenAI error ${resp.status}: ${await resp.text()}`)

  if (onStream) {
    let full = ''
    const reader = resp.body!.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
        try {
          const d = JSON.parse(line.slice(6))
          const delta = d.choices?.[0]?.delta?.content
          if (delta) { full += delta; onStream(extractCodeFromResponse(full)) }
        } catch { /* skip bad JSON */ }
      }
    }
    return extractCodeFromResponse(full)
  }
  const data = await resp.json()
  return extractCodeFromResponse(data.choices[0].message.content ?? '')
}

// ─── Google Gemini ───────────────────────────────────────────────────────────

async function callGoogle(
  apiKey: string, modelId: string, system: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  maxTokens: number, onStream?: (p: string) => void,
): Promise<string> {
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const body = {
    system_instruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { maxOutputTokens: maxTokens },
  }
  const action = onStream ? 'streamGenerateContent' : 'generateContent'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:${action}?key=${apiKey}&alt=sse`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(`Google error ${resp.status}: ${await resp.text()}`)

  let full = ''
  const reader = resp.body!.getReader()
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value)
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue
      try {
        const d = JSON.parse(line.slice(6))
        const text = d.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) { full += text; if (onStream) onStream(extractCodeFromResponse(full)) }
      } catch { /* skip */ }
    }
  }
  return extractCodeFromResponse(full)
}

// ─── Mistral ─────────────────────────────────────────────────────────────────

async function callMistral(
  apiKey: string, modelId: string, system: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  maxTokens: number, onStream?: (p: string) => void,
): Promise<string> {
  const body = {
    model: modelId,
    max_tokens: maxTokens,
    stream: !!onStream,
    messages: [{ role: 'system', content: system }, ...messages],
  }
  const resp = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(`Mistral error ${resp.status}: ${await resp.text()}`)

  if (onStream) {
    let full = ''
    const reader = resp.body!.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
        try {
          const d = JSON.parse(line.slice(6))
          const delta = d.choices?.[0]?.delta?.content
          if (delta) { full += delta; onStream(extractCodeFromResponse(full)) }
        } catch { /* skip */ }
      }
    }
    return extractCodeFromResponse(full)
  }
  const data = await resp.json()
  return extractCodeFromResponse(data.choices[0].message.content ?? '')
}

// ─── Groq ─────────────────────────────────────────────────────────────────────
// Groq uses the same OpenAI-compatible chat completions format, just a
// different base URL and API key.

async function callGroq(
  apiKey: string, modelId: string, system: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  maxTokens: number, onStream?: (p: string) => void,
): Promise<string> {
  const body = {
    model: modelId,
    max_tokens: maxTokens,
    stream: !!onStream,
    messages: [{ role: 'system', content: system }, ...messages],
  }
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(`Groq error ${resp.status}: ${await resp.text()}`)

  if (onStream) {
    let full = ''
    const reader = resp.body!.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
        try {
          const d = JSON.parse(line.slice(6))
          const delta = d.choices?.[0]?.delta?.content
          if (delta) { full += delta; onStream(extractCodeFromResponse(full)) }
        } catch { /* skip bad JSON */ }
      }
    }
    return extractCodeFromResponse(full)
  }
  const data = await resp.json()
  return extractCodeFromResponse(data.choices[0].message.content ?? '')
}

// ─── Short text (diff, autocomplete) ─────────────────────────────────────────

export async function generateText(opts: Omit<GenerateOpts, 'onStream'>): Promise<string> {
  return generate({ ...opts, maxTokens: 512 })
}
