import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../db/db'
import { deleteBudget, upsertBudget } from '../db/repo'
import { ALL_SCOPE } from '../db/schema'
import { total, useExpensesInRange } from '../hooks/useExpenses'
import { usePeriod } from '../hooks/useSettings'
import { CATEGORIES, categoryMeta } from '../lib/categories'
import { periodRange } from '../lib/dates'
import { money } from '../lib/format'
import { Card, EmptyState, PageTitle, PeriodToggle, SectionTitle } from '../components/ui'

export function Budgets() {
  const [period, setPeriod] = usePeriod()
  const range = useMemo(() => periodRange(period, 0), [period])
  const expenses = useExpensesInRange(range)
  const budgets = useLiveQuery(() => db.budgets.where('period').equals(period).toArray(), [period])

  const [scope, setScope] = useState(ALL_SCOPE)
  const [amount, setAmount] = useState('')

  if (!expenses || !budgets) return <p className="text-slate-400">Loading…</p>

  const spentByScope = (s: string) =>
    s === ALL_SCOPE ? total(expenses) : total(expenses.filter((e) => e.category === s))

  function add() {
    const n = Number.parseFloat(amount.replace(',', '.'))
    if (!Number.isFinite(n) || n <= 0) return
    void upsertBudget(period, scope, Math.round(n * 100) / 100)
    setAmount('')
  }

  const sorted = [...budgets].sort((a, b) => (a.scope === ALL_SCOPE ? -1 : a.scope.localeCompare(b.scope)))

  return (
    <div>
      <PageTitle right={<PeriodToggle value={period} onChange={setPeriod} />}>Budgets</PageTitle>
      <p className="mb-4 text-sm text-slate-400">
        Limits for the current {period === 'weekly' ? 'week' : 'month'} ({range.label}).
      </p>

      <Card>
        <SectionTitle>New budget</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value={ALL_SCOPE}>Overall</option>
            {CATEGORIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <button
            type="button"
            onClick={add}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
          >
            Set
          </button>
        </div>
      </Card>

      <SectionTitle>Your budgets</SectionTitle>
      {sorted.length === 0 ? (
        <EmptyState icon="🎯" title="No budgets yet" hint="Set an overall or per-category limit above." />
      ) : (
        <div className="space-y-3">
          {sorted.map((b) => {
            const spent = spentByScope(b.scope)
            const pct = b.amount ? (spent / b.amount) * 100 : 0
            const over = spent > b.amount
            const meta = b.scope === ALL_SCOPE ? null : categoryMeta(b.scope)
            return (
              <Card key={b.id}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    {meta ? `${meta.emoji} ${b.scope}` : '💰 Overall'}
                  </span>
                  <button
                    type="button"
                    onClick={() => void deleteBudget(b.id)}
                    className="text-xs text-slate-300 hover:text-red-500"
                  >
                    Remove
                  </button>
                </div>
                <div className="mb-1 flex justify-between text-xs text-slate-400">
                  <span className={over ? 'font-semibold text-red-500' : ''}>
                    {money(spent)} spent
                  </span>
                  <span>of {money(b.amount)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                {over && (
                  <p className="mt-1 text-xs font-medium text-red-500">
                    Over by {money(spent - b.amount)}
                  </p>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
