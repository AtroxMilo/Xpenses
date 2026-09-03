import Dexie, { type EntityTable } from 'dexie'
import type { Budget, Expense, Goal, LineItem, Setting } from './schema'

export const db = new Dexie('xpenses') as Dexie & {
  expenses: EntityTable<Expense, 'id'>
  lineItems: EntityTable<LineItem, 'id'>
  budgets: EntityTable<Budget, 'id'>
  goals: EntityTable<Goal, 'id'>
  settings: EntityTable<Setting, 'key'>
}

db.version(1).stores({
  expenses: 'id, date, category, createdAt',
  lineItems: 'id, expenseId',
  budgets: 'id, [period+scope]',
  goals: 'id, createdAt',
  settings: 'key',
})

export function uid(): string {
  return crypto.randomUUID()
}

// ---- Settings helpers -------------------------------------------------------

export async function getSetting(key: string, fallback: string): Promise<string> {
  const row = await db.settings.get(key)
  return row?.value ?? fallback
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.settings.put({ key, value })
}

// ---- Export / import -------------------------------------------------------

export async function exportAll(): Promise<string> {
  const [expenses, lineItems, budgets, goals, settings] = await Promise.all([
    db.expenses.toArray(),
    db.lineItems.toArray(),
    db.budgets.toArray(),
    db.goals.toArray(),
    db.settings.toArray(),
  ])
  return JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), expenses, lineItems, budgets, goals, settings },
    null,
    2,
  )
}

export async function importAll(json: string): Promise<void> {
  const data = JSON.parse(json)
  await db.transaction('rw', db.expenses, db.lineItems, db.budgets, db.goals, db.settings, async () => {
    await Promise.all([
      db.expenses.clear(),
      db.lineItems.clear(),
      db.budgets.clear(),
      db.goals.clear(),
      db.settings.clear(),
    ])
    if (data.expenses) await db.expenses.bulkAdd(data.expenses)
    if (data.lineItems) await db.lineItems.bulkAdd(data.lineItems)
    if (data.budgets) await db.budgets.bulkAdd(data.budgets)
    if (data.goals) await db.goals.bulkAdd(data.goals)
    if (data.settings) await db.settings.bulkAdd(data.settings)
  })
}
