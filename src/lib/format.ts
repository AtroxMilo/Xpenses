/** Currency is deliberately not modelled — amounts are plain numbers. */
const NUM = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const NUM0 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })

export function money(n: number): string {
  return NUM.format(n)
}

export function compact(n: number): string {
  return NUM0.format(n)
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}

export function signedPct(p: number | null): string {
  if (p === null) return '—'
  const s = p > 0 ? '+' : ''
  return `${s}${p.toFixed(0)}%`
}
