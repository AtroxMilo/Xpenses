export type AiProvider = 'gemini' | 'openai' | 'anthropic' | 'openrouter'

export interface AiConfig {
  provider: AiProvider
  apiKey: string
  /** Optional model override; each provider has a sensible cheap default. */
  model: string
}

export interface ProviderInfo {
  id: AiProvider
  label: string
  defaultModel: string
  /** Where a user gets a key, shown in Settings. */
  keyUrl: string
  freeTierNote: string
  /** false = browser CORS usually blocks direct calls (needs a proxy). */
  browserFriendly: boolean
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    defaultModel: 'gemini-3.6-flash',
    keyUrl: 'https://aistudio.google.com/apikey',
    freeTierNote: 'Free tier, no card needed — ~1,500 requests/day. Recommended.',
    browserFriendly: true,
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    defaultModel: 'google/gemini-3.6-flash',
    keyUrl: 'https://openrouter.ai/keys',
    freeTierNote: 'One key, many models — includes free vision models.',
    browserFriendly: true,
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    defaultModel: 'claude-haiku-4-5',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    freeTierNote: 'Pay as you go (~1–2¢ per receipt). Small trial credit on signup.',
    browserFriendly: true,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
    freeTierNote: 'Pay as you go. NOT the ChatGPT subscription — separate API billing. May be blocked by browser CORS.',
    browserFriendly: false,
  },
]

export function providerInfo(id: AiProvider): ProviderInfo {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0]
}

// ---- Extraction result ---------------------------------------------------

export interface ReceiptLineItemDraft {
  name: string
  qty: number
  unitPrice: number
  lineTotal: number
}

export interface ReceiptDraft {
  merchant: string
  /** ISO date or '' if the model couldn't read one. */
  date: string
  total: number
  category: string
  lineItems: ReceiptLineItemDraft[]
}
