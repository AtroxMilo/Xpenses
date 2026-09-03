import { useRef, useState } from 'react'
import { db, exportAll, importAll } from '../db/db'
import { addExpense } from '../db/repo'
import { useAiConfig } from '../hooks/useAiConfig'
import { usePeriod } from '../hooks/useSettings'
import { useTheme } from '../hooks/useTheme'
import type { Theme } from '../lib/theme'
import { PROVIDERS, providerInfo } from '../lib/ai/types'
import { CATEGORIES } from '../lib/categories'
import { toISODate } from '../lib/dates'
import { Card, PageTitle, PeriodToggle, SectionTitle } from '../components/ui'
import { SyncCard } from '../components/SyncCard'

export function Settings() {
  const [period, setPeriod] = usePeriod()
  const [theme, setTheme] = useTheme()
  const { config, setProvider, setApiKey, setModel } = useAiConfig()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [showKey, setShowKey] = useState(false)
  const info = providerInfo(config.provider)

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

      <SectionTitle>Appearance</SectionTitle>
      <Card className="flex items-center justify-between">
        <span className="text-sm text-slate-600 dark:text-slate-300">Theme</span>
        <div className="inline-flex rounded-full bg-slate-200 p-1 text-sm dark:bg-slate-800">
          {(['light', 'dark', 'system'] as Theme[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={`rounded-full px-3 py-1 font-medium capitalize transition ${
                theme === t
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white'
                  : 'text-slate-500'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </Card>

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

      <SyncCard />

      <SectionTitle>Receipt scanning</SectionTitle>
      <Card className="space-y-3">
        <p className="text-xs text-slate-400">
          Bring your own AI key — it is stored only in this browser and sent straight to the
          provider you pick, never to an Xpenses server.
        </p>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Provider
          </span>
          <select
            value={config.provider}
            onChange={(e) => setProvider(e.target.value as typeof config.provider)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          {info.freeTierNote}{' '}
          <a
            href={info.keyUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline"
          >
            Get a key ↗
          </a>
        </p>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            API key
          </span>
          <div className="flex gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              value={config.apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your key"
              autoComplete="off"
              spellCheck={false}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-900"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Model <span className="normal-case text-slate-300">(optional override)</span>
          </span>
          <input
            value={config.model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={info.defaultModel}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </label>

        <p className="text-xs text-slate-400">
          Receipts are read in any language and saved in English.
        </p>
      </Card>

      <p className="mt-6 text-center text-xs text-slate-300">Xpenses · local-first MVP</p>
    </div>
  )
}
