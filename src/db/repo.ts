import { db, uid } from './db'
import type { Expense, Period } from './schema'

// ---- Expenses -------------------------------------------------------------

export interface ExpenseInput {
  date: string
  amount: number
  category: string
  tags: string[]
  note: string
  merchant?: string
  source?: 'manual' | 'receipt'
}

export async function addExpense(input: ExpenseInput): Promise<string> {
  const now = Date.now()
  const id = uid()
  await db.expenses.add({
    id,
    date: input.date,
    amount: input.amount,
    category: input.category,
    tags: input.tags,
    note: input.note,
    merchant: input.merchant,
    source: input.source ?? 'manual',
    createdAt: now,
    updatedAt: now,
  })
  return id
}

export async function updateExpense(id: string, patch: Partial<Expense>): Promise<void> {
  await db.expenses.update(id, { ...patch, updatedAt: Date.now() })
}

export interface LineItemInput {
  name: string
  qty: number
  unitPrice: number
  lineTotal: number
}

/** Used by receipt scanning: one expense plus its itemised breakdown. */
export async function addExpenseWithLineItems(
  input: ExpenseInput,
  items: LineItemInput[],
): Promise<string> {
  const id = await addExpense({ ...input, source: 'receipt' })
  if (items.length) {
    await db.lineItems.bulkAdd(items.map((it) => ({ id: uid(), expenseId: id, ...it })))
  }
  return id
}

export async function deleteExpense(id: string): Promise<void> {
  await db.transaction('rw', db.expenses, db.lineItems, async () => {
    await db.lineItems.where('expenseId').equals(id).delete()
    await db.expenses.delete(id)
  })
}

// ---- Budgets ------------------------------------------------------------

export async function upsertBudget(period: Period, scope: string, amount: number): Promise<void> {
  const existing = await db.budgets.where({ period, scope }).first()
  if (existing) {
    await db.budgets.update(existing.id, { amount })
  } else {
    await db.budgets.add({ id: uid(), period, scope, amount })
  }
}

export async function deleteBudget(id: string): Promise<void> {
  await db.budgets.delete(id)
}

// ---- Goals ------------------------------------------------------------

export async function addGoal(text: string, targetAmount?: number): Promise<void> {
  await db.goals.add({ id: uid(), text, targetAmount, done: false, createdAt: Date.now() })
}

export async function toggleGoal(id: string, done: boolean): Promise<void> {
  await db.goals.update(id, { done })
}

export async function deleteGoal(id: string): Promise<void> {
  await db.goals.delete(id)
}
