export interface CategoryDef {
  name: string
  emoji: string
  color: string
}

/** Starter categories. Users can still type anything they want. */
export const CATEGORIES: CategoryDef[] = [
  { name: 'Groceries', emoji: '🛒', color: '#22c55e' },
  { name: 'Restaurant', emoji: '🍽️', color: '#f97316' },
  { name: 'Transport', emoji: '🚌', color: '#3b82f6' },
  { name: 'Leisure', emoji: '🎬', color: '#a855f7' },
  { name: 'Sports', emoji: '⚽', color: '#14b8a6' },
  { name: 'Health', emoji: '💊', color: '#ef4444' },
  { name: 'Bills', emoji: '🧾', color: '#eab308' },
  { name: 'Shopping', emoji: '🛍️', color: '#ec4899' },
  { name: 'Home', emoji: '🏠', color: '#8b5cf6' },
  { name: 'Other', emoji: '📦', color: '#64748b' },
]

const FALLBACK_COLORS = ['#0ea5e9', '#f43f5e', '#84cc16', '#f59e0b', '#6366f1', '#10b981']

export function categoryMeta(name: string): CategoryDef {
  const found = CATEGORIES.find((c) => c.name.toLowerCase() === name.toLowerCase())
  if (found) return found
  // Stable colour for custom categories.
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  const color = FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length]
  return { name, emoji: '🏷️', color }
}
