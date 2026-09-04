import type { AiConfig } from './types'

/**
 * Each adapter takes the encoded image + prompt and returns the model's raw
 * text response (expected to be a JSON object string). Network/HTTP errors
 * are thrown with a human-readable message. `signal` is wired up to the
 * "Cancel" button in the UI — adapters pass it straight through to fetch.
 */
type Adapter = (
  base64: string,
  mimeType: string,
  prompt: string,
  cfg: AiConfig,
  signal?: AbortSignal,
) => Promise<string>

/** Thrown when the user cancels a request. Caught separately in the UI so it
 * doesn't show up as a red error box. */
export class CancelledError extends Error {
  constructor() {
    super('Cancelled.')
    this.name = 'CancelledError'
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Statuses worth a couple of automatic retries — transient server-side
 * overload rather than something the user can fix (bad key, quota, etc). */
const RETRYABLE_STATUS = new Set([502, 503, 504])

function combineSignals(a?: AbortSignal, b?: AbortSignal): AbortSignal | undefined {
  if (!a) return b
  if (!b) return a
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([a, b])
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (a.aborted || b.aborted) controller.abort()
  a.addEventListener('abort', abort)
  b.addEventListener('abort', abort)
  return controller.signal
}

/**
 * fetch() with a per-attempt timeout, up to 2 automatic retries on transient
 * 502/503/504 responses or network blips, and support for user cancellation
 * via `signal`. Returns whatever Response it ends up with (may still be
 * !ok) — callers translate that into a message via `asError`.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: { signal?: AbortSignal; timeoutMs?: number; retries?: number } = {},
): Promise<Response> {
  const { signal: userSignal, timeoutMs = 20_000, retries = 2 } = opts
  if (userSignal?.aborted) throw new CancelledError()
  for (let attempt = 0; ; attempt++) {
    const timeoutCtrl = new AbortController()
    const timer = setTimeout(() => timeoutCtrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...init, signal: combineSignals(userSignal, timeoutCtrl.signal) })
      clearTimeout(timer)
      if (RETRYABLE_STATUS.has(res.status) && attempt < retries) {
        await sleep(1200 * 2 ** attempt)
        continue
      }
      return res
    } catch {
      clearTimeout(timer)
      if (userSignal?.aborted) throw new CancelledError()
      if (attempt < retries) {
        await sleep(1200 * 2 ** attempt)
        continue
      }
      throw new Error(
        timeoutCtrl.signal.aborted
          ? `Timed out after ${Math.round(timeoutMs / 1000)}s waiting for a reply. Check your connection and try again.`
          : `Could not reach the server. Check your connection and try again.`,
      )
    }
  }
}

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
  if (RETRYABLE_STATUS.has(res.status)) {
    throw new Error(
      `${provider} is overloaded right now (${res.status}). It usually clears up within a minute or two — please try again.`,
    )
  }
  throw new Error(`${provider}: request failed (${res.status}). ${detail}`)
}

const gemini: Adapter = async (base64, mimeType, prompt, cfg, signal) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    cfg.model,
  )}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`
  const res = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { parts: [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: prompt }] },
        ],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    },
    { signal },
  )
  if (!res.ok) await asError(res, 'Gemini')
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join('')
  if (!text) throw new Error('Gemini: empty response')
  return text
}

const openaiCompatible =
  (endpoint: string, provider: string, extraHeaders: Record<string, string> = {}): Adapter =>
  async (base64, mimeType, prompt, cfg, signal) => {
    const res = await fetchWithRetry(
      endpoint,
      {
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
      },
      { signal },
    )
    if (!res.ok) await asError(res, provider)
    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content
    if (!text) throw new Error(`${provider}: empty response`)
    return text
  }

const anthropic: Adapter = async (base64, mimeType, prompt, cfg, signal) => {
  const res = await fetchWithRetry(
    'https://api.anthropic.com/v1/messages',
    {
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
    },
    { signal },
  )
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
  signal?: AbortSignal,
): Promise<string> {
  return ADAPTERS[cfg.provider](base64, mimeType, prompt, cfg, signal)
}
