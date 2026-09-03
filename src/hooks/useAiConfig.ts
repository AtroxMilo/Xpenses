import { useLiveQuery } from 'dexie-react-hooks'
import { db, setSetting } from '../db/db'
import { type AiConfig, type AiProvider, providerInfo } from '../lib/ai/types'

const KEYS = {
  provider: 'ai.provider',
  apiKey: 'ai.apiKey',
  model: 'ai.model',
} as const

export function useAiConfig(): {
  config: AiConfig
  ready: boolean
  setProvider: (p: AiProvider) => void
  setApiKey: (k: string) => void
  setModel: (m: string) => void
} {
  const rows = useLiveQuery(
    () => db.settings.bulkGet([KEYS.provider, KEYS.apiKey, KEYS.model]),
    [],
  )

  const provider = (rows?.[0]?.value as AiProvider) || 'gemini'
  const apiKey = rows?.[1]?.value ?? ''
  const model = rows?.[2]?.value || providerInfo(provider).defaultModel

  return {
    config: { provider, apiKey, model },
    ready: apiKey.trim().length > 0,
    setProvider: (p) => {
      void setSetting(KEYS.provider, p)
      // Reset the model override so the new provider's default applies.
      void setSetting(KEYS.model, '')
    },
    setApiKey: (k) => void setSetting(KEYS.apiKey, k.trim()),
    setModel: (m) => void setSetting(KEYS.model, m.trim()),
  }
}
