import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { addExpenseWithLineItems } from '../db/repo'
import { useAiConfig } from '../hooks/useAiConfig'
import { parseReceipt } from '../lib/ai/parseReceipt'
import { CancelledError } from '../lib/ai/providers'
import type { ReceiptDraft } from '../lib/ai/types'
import { providerInfo } from '../lib/ai/types'
import { CATEGORIES } from '../lib/categories'
import { todayISO } from '../lib/dates'
import { money } from '../lib/format'
import { encodeImageForUpload } from '../lib/image'

type Phase = 'idle' | 'working' | 'review'

const input =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900'

export function ScanReceipt() {
  const navigate = useNavigate()
  const { config, ready } = useAiConfig()
  const fileRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState('')
  const [draft, setDraft] = useState<ReceiptDraft | null>(null)
  const [workingHint, setWorkingHint] = useState('')

  // Reassure the user it's still going, not frozen — Gemini in particular
  // can take a while (or need a retry) when it's under heavy load.
  useEffect(() => {
    if (phase !== 'working') return
    const t1 = setTimeout(
      () => setWorkingHint('Still working — this can take a bit longer when the AI is busy…'),
      8_000,
    )
    const t2 = setTimeout(
      () => setWorkingHint('Taking longer than usual. Feel free to cancel and try again.'),
      25_000,
    )
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [phase])

  async function onPick(file: File) {
    setError('')
    setWorkingHint('')
    setPhase('working')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const img = await encodeImageForUpload(file)
      setPreview(img.dataUrl)
      const result = await parseReceipt(img.base64, img.mimeType, config, controller.signal)
      setDraft({ ...result, date: result.date || todayISO() })
      setPhase('review')
    } catch (e) {
      if (e instanceof CancelledError) {
        setPhase('idle')
        return
      }
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setPhase('idle')
    } finally {
      abortRef.current = null
    }
  }

  function cancel() {
    abortRef.current?.abort()
  }

  function patch(p: Partial<ReceiptDraft>) {
    setDraft((d) => (d ? { ...d, ...p } : d))
  }

  function patchItem(i: number, p: Partial<ReceiptDraft['lineItems'][number]>) {
    setDraft((d) => {
      if (!d) return d
      const lineItems = d.lineItems.map((it, idx) => (idx === i ? { ...it, ...p } : it))
      return { ...d, lineItems }
    })
  }

  async function save() {
    if (!draft) return
    setPhase('working')
    await addExpenseWithLineItems(
      {
        date: draft.date,
        amount: draft.total,
        category: draft.category || 'Other',
        merchant: draft.merchant || undefined,
        note: '',
        tags: [],
      },
      draft.lineItems,
    )
    navigate('/expenses')
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm font-medium text-slate-500"
        >
          ← Back
        </button>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">Scan receipt</h1>
        <span className="w-12" />
      </div>

      {!ready && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Add a free AI key first —{' '}
          <Link to="/settings" className="font-semibold underline">
            Settings → Receipt scanning
          </Link>
          .
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {phase === 'idle' && (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <span className="text-5xl">📸</span>
          <p className="text-sm text-slate-500">
            Take or pick a photo of a receipt. {providerInfo(config.provider).label} reads the
            merchant, total and each item (translated to English) — you check it before saving.
          </p>
          <button
            type="button"
            disabled={!ready}
            onClick={() => fileRef.current?.click()}
            className="rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
          >
            Choose / take photo
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onPick(f)
              e.target.value = ''
            }}
          />
        </div>
      )}

      {phase === 'working' && (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-slate-500">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900 dark:border-t-white" />
          <p className="text-sm">Reading the receipt…</p>
          {workingHint && <p className="max-w-xs text-xs text-slate-400">{workingHint}</p>}
          <button
            type="button"
            onClick={cancel}
            className="mt-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-500 dark:border-slate-700"
          >
            Cancel
          </button>
        </div>
      )}

      {phase === 'review' && draft && (
        <div className="space-y-4">
          {preview && (
            <img
              src={preview}
              alt="Receipt"
              className="max-h-48 w-full rounded-xl object-contain ring-1 ring-slate-200 dark:ring-slate-700"
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Merchant
              </span>
              <input
                className={input}
                value={draft.merchant}
                onChange={(e) => patch({ merchant: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Date
              </span>
              <input
                type="date"
                className={input}
                value={draft.date}
                onChange={(e) => patch({ date: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Total
              </span>
              <input
                inputMode="decimal"
                className={input}
                value={String(draft.total)}
                onChange={(e) => patch({ total: Number.parseFloat(e.target.value) || 0 })}
              />
            </label>
          </div>

          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Category
            </span>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => patch({ category: c.name })}
                  className={`rounded-full px-3 py-1 text-sm transition ${
                    draft.category === c.name
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {c.emoji} {c.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Items ({draft.lineItems.length})
              </span>
              {(() => {
                const sum =
                  Math.round(draft.lineItems.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100
                const mismatch = draft.lineItems.length > 0 && Math.abs(sum - draft.total) > 0.01
                return mismatch ? (
                  <span className="text-xs text-amber-500">items add up to {money(sum)}</span>
                ) : null
              })()}
            </div>
            <div className="space-y-2">
              {draft.lineItems.map((it, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200 p-2 dark:border-slate-700"
                >
                  <input
                    className={`${input} mb-2`}
                    value={it.name}
                    onChange={(e) => patchItem(i, { name: e.target.value })}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      inputMode="decimal"
                      aria-label="Quantity"
                      className={`${input} w-16`}
                      value={String(it.qty)}
                      onChange={(e) =>
                        patchItem(i, { qty: Number.parseFloat(e.target.value) || 0 })
                      }
                    />
                    <span className="text-slate-400">×</span>
                    <input
                      inputMode="decimal"
                      aria-label="Unit price"
                      className={`${input} flex-1`}
                      value={String(it.unitPrice)}
                      onChange={(e) =>
                        patchItem(i, { unitPrice: Number.parseFloat(e.target.value) || 0 })
                      }
                    />
                    <span className="text-slate-400">=</span>
                    <input
                      inputMode="decimal"
                      aria-label="Line total"
                      className={`${input} w-20`}
                      value={String(it.lineTotal)}
                      onChange={(e) =>
                        patchItem(i, { lineTotal: Number.parseFloat(e.target.value) || 0 })
                      }
                    />
                    <button
                      type="button"
                      aria-label="Remove item"
                      onClick={() =>
                        patch({ lineItems: draft.lineItems.filter((_, idx) => idx !== i) })
                      }
                      className="px-1 text-slate-300 hover:text-red-500"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  patch({
                    lineItems: [
                      ...draft.lineItems,
                      { name: '', qty: 1, unitPrice: 0, lineTotal: 0 },
                    ],
                  })
                }
                className="w-full rounded-xl border border-dashed border-slate-300 py-2 text-sm text-slate-500 dark:border-slate-700"
              >
                + Add item
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={save}
            className="w-full rounded-xl bg-slate-900 py-3 font-semibold text-white dark:bg-white dark:text-slate-900"
          >
            Save expense
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(null)
              setPreview('')
              setPhase('idle')
            }}
            className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-500 dark:border-slate-700"
          >
            Discard & rescan
          </button>
        </div>
      )}
    </div>
  )
}
