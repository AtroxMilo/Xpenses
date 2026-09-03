import type { ReactNode } from 'react'
import type { Period } from '../db/schema'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-slate-400 first:mt-0">
      {children}
    </h2>
  )
}

export function PageTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{children}</h1>
      {right}
    </div>
  )
}

export function PeriodToggle({
  value,
  onChange,
}: {
  value: Period
  onChange: (p: Period) => void
}) {
  return (
    <div className="inline-flex rounded-full bg-slate-200 p-1 text-sm dark:bg-slate-800">
      {(['weekly', 'monthly'] as Period[]).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`rounded-full px-3 py-1 font-medium capitalize transition ${
            value === p
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white'
              : 'text-slate-500'
          }`}
        >
          {p === 'weekly' ? 'Week' : 'Month'}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <span className="text-4xl">{icon}</span>
      <p className="font-medium text-slate-600 dark:text-slate-300">{title}</p>
      {hint && <p className="text-sm text-slate-400">{hint}</p>}
    </div>
  )
}
