export type Period = 'weekly' | 'monthly'

export interface Expense {
  id: string
  /** ISO date string, e.g. 2026-09-03 (no time component needed) */
  date: string
  /** Plain number. Currency is intentionally not modelled for the MVP. */
  amount: number
  category: string
  tags: string[]
  note: string
  merchant?: string
  source: 'manual' | 'receipt'
  createdAt: number
  updatedAt: number
}

/** Receipt line items — populated in v2 when receipt scanning lands. */
export interface LineItem {
  id: string
  expenseId: string
  name: string
  qty: number
  unitPrice: number
  lineTotal: number
}

export interface Budget {
  id: string
  period: Period
  /** '__all__' means a single overall budget, otherwise a category name. */
  scope: string
  amount: number
}

export interface Goal {
  id: string
  text: string
  targetAmount?: number
  done: boolean
  createdAt: number
}

export interface Setting {
  key: string
  value: string
}

export const ALL_SCOPE = '__all__'
