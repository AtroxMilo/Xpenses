import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Expense } from '../db/schema'
import { type Range, inRange } from '../lib/dates'

export function useExpensesInRange(range: Range): Expense[] | undefined {
  return useLiveQuery(
    () => db.expenses.where('date').between(range.start, range.end, true, true).toArray(),
    [range.start, range.end],
  )
}

export function useAllExpenses(): Expense[] | undefined {
  return useLiveQuery(() => db.expenses.orderBy('date').reverse().toArray(), [])
}

export interface CategoryTotal {
  category: string
  total: number
}

export function sumByCategory(expenses: Expense[]): CategoryTotal[] {
  const map = new Map<string, number>()
  for (const e of expenses) map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
}

export function total(expenses: Expense[]): number {
  return expenses.reduce((s, e) => s + e.amount, 0)
}

export function filterRange(expenses: Expense[], range: Range): Expense[] {
  return expenses.filter((e) => inRange(e.date, range))
}
