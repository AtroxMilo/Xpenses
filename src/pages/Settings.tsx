import { useRef, useState } from 'react'
import { db, exportAll, importAll } from '../db/db'
import { addExpense } from '../db/repo'
import { usePeriod } from '../hooks/useSettings'
import { CATEGORIES } from '../lib/categories'
import { toISODate } from '../lib/dates'
import { Card, PageTitle, PeriodToggle, SectionTitle } from '../components/ui'

export function Settings() {
  const [period, setPeriod] = usePeriod()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')

  async function doExport() {
    const json = await exportAll()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `xpenses-backup-${toISODate(new Date())}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function doImport(file: File) {
    try {
      await importAll(await file.text())
      setMsg('Import complete.')
    } catch {
      setMsg('Import failed — is that a valid Xpenses backup?')
    }
  }

  async function seedDemo() {
    const today = new Date()
    for (let i = 0; i < 40; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - Math.floor(Math.random() * 60))
      const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]
      await addExpense({
        date: toISODate(d),
        amount: Math.round((Math.random() * 60 + 3) * 100) / 100,
        category: cat.name,
        tags: [],
        note: '',
      })
    }
    setMsg('Added 40 sample expenses.')
  }

  async function wipe() {
    if (!confirm('Delete ALL data on this device? This cannot be undone.')) return
    await Promise.all([
      db.expenses.clear(),
      db.lineItems.clear(),
      db.budgets.clear(),
      db.goals.clear(),
    ])
    setMsg('All data cleared.')
  }

  return (
    <div>
      <PageTitle>Settings</PageTitle>

      <SectionTitle>Default period</SectionTitle>
      <Card className="flex items-center justify-between">
        <span className="text-sm text-slate-600 dark:text-slate-300">Show totals by</span>
        <PeriodToggle value={period} onChange={setPeriod} />
      </Card>

      <SectionTitle>Data</SectionTitle>
      <Card className="space-y-2">
        <p className="text-xs text-slate-400">
          Everything is stored only in this browser. Back up regularly.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={doExport}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium dark:border-slate-700"
          >
            Export backup
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium dark:border-slate-700"
          >
            Import backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void doImport(f)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={seedDemo}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium dark:border-slate-700"
          >
            Add sample data
          </button>
          <button
            type="button"
            onClick={wipe}
            className="rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-500 dark:border-red-900/50"
          >
            Clear all data
          </button>
        </div>
        {msg && <p className="text-xs text-emerald-600">{msg}</p>}
      </Card>

      <SectionTitle>Coming next</SectionTitle>
      <Card>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          📸 Receipt scanning — snap a photo and Xpenses fills in the amount, merchant and line
          items for you. Planned for the next milestone.
        </p>
      </Card>

      <p className="mt-6 text-center text-xs text-slate-300">Xpenses · local-first MVP</p>
    </div>
  )
}
