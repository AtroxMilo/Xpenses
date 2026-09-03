import { CATEGORIES } from '../categories'
import { todayISO } from '../dates'
import { receiptPrompt } from './prompt'
import { callProvider } from './providers'
import type { AiConfig, ReceiptDraft, ReceiptLineItemDraft } from './types'

const CATEGORY_NAMES = CATEGORIES.map((c) => c.name)

function num(v: unknown): number {
  const n = typeof v === 'string' ? Number.parseFloat(v.replace(',', '.')) : Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start !== -1 && end > start) return JSON.parse(trimmed.slice(start, end + 1))
    throw new Error('The model did not return readable JSON. Try again or retake the photo.')
  }
}

function normaliseDate(v: unknown): string {
  if (typeof v !== 'string') return ''
  const m = v.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return ''
  const iso = m[0]
  return iso > todayISO() ? todayISO() : iso
}

function normaliseCategory(v: unknown): string {
  if (typeof v !== 'string') return 'Other'
  const hit = CATEGORY_NAMES.find((c) => c.toLowerCase() === v.trim().toLowerCase())
  return hit ?? 'Other'
}

export async function parseReceipt(
  base64: string,
  mimeType: string,
  cfg: AiConfig,
): Promise<ReceiptDraft> {
  if (!cfg.apiKey.trim()) {
    throw new Error('No API key set. Add one under Settings → Receipt scanning.')
  }
  const raw = await callProvider(base64, mimeType, receiptPrompt(), cfg)
  const obj = extractJson(raw) as Record<string, unknown>

  const lineItems: ReceiptLineItemDraft[] = Array.isArray(obj.lineItems)
    ? (obj.lineItems as Record<string, unknown>[]).map((it) => {
        const qty = num(it.qty) || 1
        const unitPrice = num(it.unitPrice)
        const lineTotal = num(it.lineTotal) || Math.round(qty * unitPrice * 100) / 100
        return { name: String(it.name ?? '').trim() || 'Item', qty, unitPrice, lineTotal }
      })
    : []

  const itemsSum = Math.round(lineItems.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100
  const total = num(obj.total) || itemsSum

  return {
    merchant: String(obj.merchant ?? '').trim(),
    date: normaliseDate(obj.date),
    total,
    category: normaliseCategory(obj.category),
    lineItems,
  }
}
