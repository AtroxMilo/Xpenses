import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { addGoal, deleteGoal, toggleGoal } from '../db/repo'
import { money } from '../lib/format'
import { Card, EmptyState, PageTitle } from '../components/ui'

export function Goals() {
  const goals = useLiveQuery(() => db.goals.orderBy('createdAt').reverse().toArray(), [])
  const [text, setText] = useState('')
  const [target, setTarget] = useState('')

  function add() {
    if (!text.trim()) return
    const n = Number.parseFloat(target.replace(',', '.'))
    void addGoal(text.trim(), Number.isFinite(n) && n > 0 ? n : undefined)
    setText('')
    setTarget('')
  }

  if (!goals) return <p className="text-slate-400">Loading…</p>

  return (
    <div>
      <PageTitle>Goals</PageTitle>
      <p className="mb-4 text-sm text-slate-400">
        Write down what you want to change about your spending.
      </p>

      <Card>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="e.g. Eat out no more than twice a week"
          className="mb-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900"
        />
        <div className="flex gap-2">
          <input
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Target amount (optional)"
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900"
          />
          <button
            type="button"
            onClick={add}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
          >
            Add
          </button>
        </div>
      </Card>

      <div className="mt-4 space-y-2">
        {goals.length === 0 ? (
          <EmptyState icon="⭐" title="No goals yet" />
        ) : (
          goals.map((g) => (
            <Card key={g.id} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={g.done}
                onChange={(e) => void toggleGoal(g.id, e.target.checked)}
                className="h-5 w-5 shrink-0 accent-emerald-500"
              />
              <span
                className={`flex-1 text-sm ${
                  g.done
                    ? 'text-slate-400 line-through'
                    : 'text-slate-800 dark:text-slate-100'
                }`}
              >
                {g.text}
                {g.targetAmount ? (
                  <span className="ml-1 text-xs text-slate-400">· {money(g.targetAmount)}</span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => void deleteGoal(g.id)}
                className="shrink-0 text-xs text-slate-300 hover:text-red-500"
              >
                ✕
              </button>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
