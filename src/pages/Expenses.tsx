import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteExpense } from '../db/repo'
import { useAllExpenses } from '../hooks/useExpenses'
import { usePeriod } from '../hooks/useSettings'
import { categoryMeta } from '../lib/categories'
import { friendlyDate, inRange, periodRange } from '../lib/dates'
import { money } from '../lib/format'
import { Card, EmptyState, PageTitle, PeriodToggle } from '../components/ui'

export function Expenses() {
  const navigate = useNavigate()
  const [period, setPeriod] = usePeriod()
  const [scope, setScope] = useState<'period' | 'all'>('period')
  const [q, setQ] = useState('')
  const all = useAllExpenses()

  const range = useMemo(() => periodRange(period, 0), [period])

  const groups = useMemo(() => {
    if (!all) return []
    const needle = q.trim().toLowerCase()
    const filtered = all.filter((e) => {
      if (scope === 'period' && !inRange(e.date, range)) return false
      if (!needle) return true
      return (
        e.category.toLowerCase().includes(needle) ||
        e.note.toLowerCase().includes(needle) ||
        (e.merchant ?? '').toLowerCase().includes(needle) ||
        e.tags.some((t) => t.toLowerCase().includes(needle))
      )
    })
    const byDate = new Map<string, typeof filtered>()
    for (const e of filtered) {
      const list = byDate.get(e.date) ?? []
      list.push(e)
      byDate.set(e.date, list)
    }
    return [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [all, q, scope, range])

  const grandTotal = groups.reduce(
    (s, [, list]) => s + list.reduce((ss, e) => ss + e.amount, 0),
    0,
  )

  if (!all) return <p className="text-slate-400">Loading…</p>

  return (
    <div>
      <PageTitle right={<PeriodToggle value={period} onChange={setPeriod} />}>Expenses</PageTitle>

      <div className="mb-3 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search category, note, tag…"
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900"
        />
        <button
          type="button"
          onClick={() => setScope(scope === 'period' ? 'all' : 'period')}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium dark:border-slate-700 dark:bg-slate-900"
        >
          {scope === 'period' ? 'This ' + (period === 'weekly' ? 'week' : 'month') : 'All time'}
        </button>
      </div>

      {groups.length === 0 ? (
        <EmptyState icon="🧾" title="No expenses here" hint="Tap “Add expense” to record one." />
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-400">
            {groups.reduce((n, [, l]) => n + l.length, 0)} entries · {money(grandTotal)} total
          </p>
          <div className="space-y-4">
            {groups.map(([date, list]) => (
              <div key={date}>
                <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {friendlyDate(date)}
                </p>
                <Card className="!p-0">
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {list.map((e) => {
                      const meta = categoryMeta(e.category)
                      return (
                        <li key={e.id}>
                          <button
                            type="button"
                            onClick={() => navigate(`/edit/${e.id}`)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800"
                          >
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg"
                              style={{ background: meta.color + '22' }}
                            >
                              {meta.emoji}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-slate-800 dark:text-slate-100">
                                {e.merchant || e.category}
                              </span>
                              <span className="block truncate text-xs text-slate-400">
                                {e.merchant ? e.category : ''}
                                {e.note ? (e.merchant ? ' · ' : '') + e.note : ''}
                                {e.tags.length ? ` · ${e.tags.map((t) => '#' + t).join(' ')}` : ''}
                              </span>
                            </span>
                            <span className="shrink-0 font-semibold text-slate-900 dark:text-white">
                              {money(e.amount)}
                            </span>
                            <span
                              role="button"
                              tabIndex={0}
                              aria-label="Delete"
                              onClick={(ev) => {
                                ev.stopPropagation()
                                if (confirm('Delete this expense?')) void deleteExpense(e.id)
                              }}
                              onKeyDown={(ev) => {
                                if (ev.key === 'Enter') {
                                  ev.stopPropagation()
                                  if (confirm('Delete this expense?')) void deleteExpense(e.id)
                                }
                              }}
                              className="shrink-0 px-1 text-slate-300 hover:text-red-500"
                            >
                              ✕
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </Card>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
