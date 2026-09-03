import type { AiConfig } from './types'

/**
 * Each adapter takes the encoded image + prompt and returns the model's raw
 * text response (expected to be a JSON object string). Network/HTTP errors
 * are thrown with a human-readable message.
 */
type Adapter = (
  base64: string,
  mimeType: string,
  prompt: string,
  cfg: AiConfig,
) => Promise<string>

async function asError(res: Response, provider: string): Promise<never> {
  let detail = ''
  try {
    const body = await res.text()
    detail = body.slice(0, 300)
  } catch {
    /* ignore */
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(`${provider}: API key rejected (${res.status}). Check the key in Settings.`)
  }
  if (res.status === 429) {
    throw new Error(`${provider}: rate limit / quota hit (429). Try again later.`)
  }
  throw new Error(`${provider}: request failed (${res.status}). ${detail}`)
}

const gemini: Adapter = async (base64, mimeType, prompt, cfg) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    cfg.model,
  )}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [
        { parts: [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: prompt }] },
      ],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
  })
  if (!res.ok) await asError(res, 'Gemini')
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join('')
  if (!text) throw new Error('Gemini: empty response')
  return text
}

const openaiCompatible =
  (endpoint: string, provider: string, extraHeaders: Record<string, string> = {}): Adapter =>
  async (base64, mimeType, prompt, cfg) => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${cfg.apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          },
        ],
      }),
    })
    if (!res.ok) await asError(res, provider)
    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content
    if (!text) throw new Error(`${provider}: empty response`)
    return text
  }

const anthropic: Adapter = async (base64, mimeType, prompt, cfg) => {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  })
  if (!res.ok) await asError(res, 'Claude')
  const data = await res.json()
  const text = (data?.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('')
  if (!text) throw new Error('Claude: empty response')
  return text
}

const ADAPTERS: Record<AiConfig['provider'], Adapter> = {
  gemini,
  anthropic,
  openai: openaiCompatible('https://api.openai.com/v1/chat/completions', 'OpenAI'),
  openrouter: openaiCompatible('https://openrouter.ai/api/v1/chat/completions', 'OpenRouter', {
    'http-referer': 'https://xpenses.app',
    'x-title': 'Xpenses',
  }),
}

export function callProvider(
  base64: string,
  mimeType: string,
  prompt: string,
  cfg: AiConfig,
): Promise<string> {
  return ADAPTERS[cfg.provider](base64, mimeType, prompt, cfg)
}
