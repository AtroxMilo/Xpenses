import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { db } from '../db/db'
import { ALL_SCOPE } from '../db/schema'
import { sumByCategory, total, useAllExpenses, useExpensesInRange } from '../hooks/useExpenses'
import { usePeriod } from '../hooks/useSettings'
import { categoryMeta } from '../lib/categories'
import {
  daysInRange,
  friendlyDate,
  monthsInRange,
  periodNoun,
  periodRange,
  shortDay,
} from '../lib/dates'
import { money, pctChange, signedPct } from '../lib/format'
import { Card, PageTitle, PeriodToggle, SectionTitle } from '../components/ui'

export function Dashboard() {
  const [period, setPeriodSetting] = usePeriod()
  // 0 = the current week/month/year, 1 = the one before, and so on.
  const [offset, setOffset] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const current = useMemo(() => periodRange(period, offset), [period, offset])
  const previous = useMemo(() => periodRange(period, offset + 1), [period, offset])

  function setPeriod(p: typeof period) {
    setPeriodSetting(p)
    setOffset(0)
  }

  const curExpenses = useExpensesInRange(current)
  const prevExpenses = useExpensesInRange(previous)
  const allExpenses = useAllExpenses()
  const budgets = useLiveQuery(() => db.budgets.where('period').equals(period).toArray(), [period])

  if (!curExpenses || !prevExpenses || !allExpenses) {
    return <p className="text-slate-400">Loading…</p>
  }

  const curTotal = total(curExpenses)
  const prevTotal = total(prevExpenses)
  const change = pctChange(curTotal, prevTotal)
  const up = change !== null && change > 0

  const byCategory = sumByCategory(curExpenses)
  const overallBudget = budgets?.find((b) => b.scope === ALL_SCOPE)

  // A year's worth of day-bars is unreadable, so the yearly view buckets by month.
  const trend =
    period === 'yearly'
      ? monthsInRange(current).map(({ key, label }) => ({
          day: label,
          amount: curExpenses
            .filter((e) => e.date.slice(0, 7) === key)
            .reduce((s, e) => s + e.amount, 0),
        }))
      : daysInRange(current).map((iso) => ({
          day: shortDay(iso),
          amount: curExpenses
            .filter((e) => e.date.slice(0, 10) === iso)
            .reduce((s, e) => s + e.amount, 0),
        }))

  // ---- All time -----------------------------------------------------------
  const allTotal = total(allExpenses)
  const allByCategory = sumByCategory(allExpenses)
  // useAllExpenses() is already sorted by date descending.
  const firstDate = allExpenses.length ? allExpenses[allExpenses.length - 1].date : ''

  // Stop going back once the period starts before the very first expense.
  const canGoBack = firstDate !== '' && current.start > firstDate.slice(0, 10)
  const canGoForward = offset > 0
  const goBack = () => canGoBack && setOffset((o) => o + 1)
  const goForward = () => canGoForward && setOffset((o) => o - 1)
  const prevWord = offset === 0 ? 'last' : 'the previous'

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (dx > 60) goBack()
    else if (dx < -60) goForward()
  }

  const byYearMap = new Map<string, number>()
  for (const e of allExpenses) {
    const y = e.date.slice(0, 4)
    byYearMap.set(y, (byYearMap.get(y) ?? 0) + e.amount)
  }
  const byYear = [...byYearMap.entries()]
    .map(([year, amount]) => ({ year, amount }))
    .sort((a, b) => (a.year < b.year ? 1 : -1))
  const maxYear = Math.max(1, ...byYear.map((y) => y.amount))

  return (
    <div>
      <PageTitle right={<PeriodToggle value={period} onChange={setPeriod} />}>Dashboard</PageTitle>

      <Card>
        <div
          className="-mx-1 mb-1 flex items-center justify-between"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <button
            type="button"
            onClick={goBack}
            disabled={!canGoBack}
            aria-label={`Previous ${periodNoun(period)}`}
            className="rounded-full px-3 py-1 text-xl text-slate-500 active:bg-slate-200 disabled:opacity-25 dark:active:bg-slate-800"
          >
            ‹
          </button>
          <div className="text-center">
            <p className="text-sm text-slate-400">{current.label}</p>
            {offset > 0 && (
              <button
                type="button"
                onClick={() => setOffset(0)}
                className="text-xs font-medium text-blue-500"
              >
                Back to this {periodNoun(period)}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={goForward}
            disabled={!canGoForward}
            aria-label={`Next ${periodNoun(period)}`}
            className="rounded-full px-3 py-1 text-xl text-slate-500 active:bg-slate-200 disabled:opacity-25 dark:active:bg-slate-800"
          >
            ›
          </button>
        </div>
        <p
          className={`mt-1 text-4xl font-bold ${
            change === null
              ? 'text-slate-900 dark:text-white'
              : up
                ? 'text-red-500'
                : 'text-emerald-500'
          }`}
        >
          {money(curTotal)}
        </p>
        <p className="mt-1 text-sm">
          <span
            className={
              change === null
                ? 'text-slate-400'
                : up
                  ? 'text-red-500'
                  : 'text-emerald-500'
            }
          >
            {change === null
              ? `No data ${prevWord} ${periodNoun(period)}`
              : `${up ? '▲' : '▼'} ${signedPct(change)}`}
          </span>{' '}
          <span className="text-slate-400">
            vs {money(prevTotal)} {prevWord} {periodNoun(period)}
          </span>
        </p>

        {overallBudget && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-slate-400">
              <span>Budget</span>
              <span>
                {money(curTotal)} / {money(overallBudget.amount)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className={`h-full rounded-full ${
                  curTotal > overallBudget.amount ? 'bg-red-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, (curTotal / overallBudget.amount) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </Card>

      <SectionTitle>{period === 'yearly' ? 'Monthly spend' : 'Daily spend'}</SectionTitle>
      <Card className="touch-pan-y">
        <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {curTotal === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Nothing recorded this {periodNoun(period)}.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                interval="preserveStartEnd"
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(148,163,184,0.15)' }}
                formatter={(v) => money(Number(v))}
                labelStyle={{ color: '#0f172a' }}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        </div>
      </Card>

      <SectionTitle>By category</SectionTitle>
      <Card>
        {byCategory.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Nothing recorded yet.</p>
        ) : (
          <ul className="space-y-3">
            {byCategory.map(({ category, total: t }) => {
              const meta = categoryMeta(category)
              const pct = curTotal ? (t / curTotal) * 100 : 0
              return (
                <li key={category}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {meta.emoji} {category}
                    </span>
                    <span className="text-slate-500">
                      {money(t)} · {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: meta.color }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <SectionTitle>All time</SectionTitle>
      <Card>
        <p className="text-sm text-slate-400">Everything you have ever recorded</p>
        <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{money(allTotal)}</p>
        <p className="mt-1 text-sm text-slate-400">
          {allExpenses.length} {allExpenses.length === 1 ? 'entry' : 'entries'}
          {firstDate && ` · since ${friendlyDate(firstDate)}`}
        </p>
      </Card>

      {byYear.length > 0 && (
        <>
          <SectionTitle>Year by year</SectionTitle>
          <Card>
            <ul className="space-y-3">
              {byYear.map(({ year, amount }) => (
                <li key={year}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-200">{year}</span>
                    <span className="text-slate-500">{money(amount)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${(amount / maxYear) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {allByCategory.length > 0 && (
        <>
          <SectionTitle>All time by category</SectionTitle>
          <Card>
            <ul className="space-y-3">
              {allByCategory.map(({ category, total: t }) => {
                const meta = categoryMeta(category)
                const pct = allTotal ? (t / allTotal) * 100 : 0
                return (
                  <li key={category}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {meta.emoji} {category}
                      </span>
                      <span className="text-slate-500">
                        {money(t)} · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: meta.color }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        </>
      )}
    </div>
  )
}
