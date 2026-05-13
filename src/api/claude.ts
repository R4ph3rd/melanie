import Anthropic from '@anthropic-ai/sdk'
import { extractCodeFromResponse } from '../utils/codeUtils'

export const AVAILABLE_MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (free tier)' },
  { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6' },
  { id: 'claude-opus-4-7',           label: 'Claude Opus 4.7' },
]

export const DEFAULT_MODEL = AVAILABLE_MODELS[0].id

function makeClient(apiKey: string) {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

export async function generateCode(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  onStream?: (partial: string) => void,
): Promise<string> {
  const client = makeClient(apiKey)

  if (onStream) {
    let full = ''
    const stream = client.messages.stream({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    })
    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        full += event.delta.text
        onStream(extractCodeFromResponse(full))
      }
    }
    return extractCodeFromResponse(full)
  }

  const resp = await client.messages.create({
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  })
  const text = resp.content[0].type === 'text' ? resp.content[0].text : ''
  return extractCodeFromResponse(text)
}

export async function getDiffText(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const client = makeClient(apiKey)
  const resp = await client.messages.create({
    model,
    max_tokens: 512,
    system: systemPrompt,
    messages,
  })
  return resp.content[0].type === 'text' ? resp.content[0].text.trim() : ''
}

export async function getAutocompleteSuggestions(
  apiKey: string,
  model: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
): Promise<string[]> {
  const client = makeClient(apiKey)
  try {
    const resp = await client.messages.create({
      model,
      max_tokens: 256,
      system: `Your role is to provide autocomplete results for a creative coding prompt editor.
Provide exactly 3 diverse suggestions. Respond ONLY with a JSON array of 3 strings.`,
      messages,
    })
    const text = resp.content[0].type === 'text' ? resp.content[0].text.trim() : '[]'
    // Parse JSON array from response
    const match = text.match(/\[[\s\S]*\]/)
    if (match) {
      const parsed = JSON.parse(match[0])
      if (Array.isArray(parsed)) return parsed.slice(0, 3).map(String)
    }
  } catch { /* ignore autocomplete errors */ }
  return []
}
