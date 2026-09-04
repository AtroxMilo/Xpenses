import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/db'
import { addExpense, deleteExpense, replaceLineItems, updateExpense, type LineItemInput } from '../db/repo'
import type { LineItem } from '../db/schema'
import { CATEGORIES } from '../lib/categories'
import { todayISO } from '../lib/dates'
import { money } from '../lib/format'

const smallInput =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900'

export function AddExpense() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editing = Boolean(id)
  const existing = useLiveQuery(() => (id ? db.expenses.get(id) : undefined), [id])
  const existingLineItems = useLiveQuery(
    () =>
      id
        ? db.lineItems.where('expenseId').equals(id).toArray()
        : Promise.resolve<LineItem[]>([]),
    [id],
  )

  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [category, setCategory] = useState('Groceries')
  const [merchant, setMerchant] = useState('')
  const [note, setNote] = useState('')
  const [tags, setTags] = useState('')
  const [lineItems, setLineItems] = useState<LineItemInput[]>([])
  const [loadedId, setLoadedId] = useState<string>()
  const [loadedItemsId, setLoadedItemsId] = useState<string>()

  // Populate the form once the record for this :id has loaded (React's
  // "adjust state while rendering" pattern — runs once per record).
  if (existing && loadedId !== existing.id) {
    setLoadedId(existing.id)
    setAmount(String(existing.amount))
    setDate(existing.date)
    setCategory(existing.category)
    setMerchant(existing.merchant ?? '')
    setNote(existing.note)
    setTags(existing.tags.join(', '))
  }

  // Same pattern for the itemised breakdown — loads separately since it's a
  // different table, so it's gated on its own id.
  if (id && existingLineItems && loadedItemsId !== id) {
    setLoadedItemsId(id)
    setLineItems(
      existingLineItems.map((it) => ({
        name: it.name,
        qty: it.qty,
        unitPrice: it.unitPrice,
        lineTotal: it.lineTotal,
      })),
    )
  }

  function patchItem(i: number, p: Partial<LineItemInput>) {
    setLineItems((items) => items.map((it, idx) => (idx === i ? { ...it, ...p } : it)))
  }

  const parsedAmount = Number.parseFloat(amount.replace(',', '.'))
  const valid = Number.isFinite(parsedAmount) && parsedAmount > 0 && category.trim().length > 0
  const itemsSum = Math.round(lineItems.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100
  const itemsMismatch =
    lineItems.length > 0 && Number.isFinite(parsedAmount) && Math.abs(itemsSum - parsedAmount) > 0.01

  async function save() {
    if (!valid) return
    const payload = {
      date,
      amount: Math.round(parsedAmount * 100) / 100,
      category: category.trim(),
      merchant: merchant.trim() || undefined,
      note: note.trim(),
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    }
    let expenseId: string
    if (editing && id) {
      await updateExpense(id, payload)
      expenseId = id
    } else {
      expenseId = await addExpense(payload)
    }
    await replaceLineItems(expenseId, lineItems)
    navigate(-1)
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm font-medium text-slate-500"
        >
          ← Cancel
        </button>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          {editing ? 'Edit expense' : 'Add expense'}
        </h1>
        <span className="w-14" />
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Amount
          </label>
          <input
            autoFocus={!editing}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-2xl font-bold outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Category
          </label>
          <div className="mb-2 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setCategory(c.name)}
                className={`rounded-full px-3 py-1 text-sm transition ${
                  category === c.name
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {c.emoji} {c.name}
              </button>
            ))}
          </div>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="or type your own"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Merchant
            </label>
            <input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="optional"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Note
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="optional"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Tags (comma separated)
          </label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="football, weekend"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Items ({lineItems.length})
            </span>
            {itemsMismatch && (
              <span className="text-xs text-amber-500">items add up to {money(itemsSum)}</span>
            )}
          </div>
          <div className="space-y-2">
            {lineItems.map((it, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                <input
                  className={`${smallInput} mb-2`}
                  value={it.name}
                  onChange={(e) => patchItem(i, { name: e.target.value })}
                  placeholder="Item name"
                />
                <div className="flex items-center gap-2">
                  <input
                    inputMode="decimal"
                    aria-label="Quantity"
                    className={`${smallInput} w-16`}
                    value={String(it.qty)}
                    onChange={(e) => patchItem(i, { qty: Number.parseFloat(e.target.value) || 0 })}
                  />
                  <span className="text-slate-400">×</span>
                  <input
                    inputMode="decimal"
                    aria-label="Unit price"
                    className={`${smallInput} flex-1`}
                    value={String(it.unitPrice)}
                    onChange={(e) =>
                      patchItem(i, { unitPrice: Number.parseFloat(e.target.value) || 0 })
                    }
                  />
                  <span className="text-slate-400">=</span>
                  <input
                    inputMode="decimal"
                    aria-label="Line total"
                    className={`${smallInput} w-20`}
                    value={String(it.lineTotal)}
                    onChange={(e) =>
                      patchItem(i, { lineTotal: Number.parseFloat(e.target.value) || 0 })
                    }
                  />
                  <button
                    type="button"
                    aria-label="Remove item"
                    onClick={() => setLineItems((items) => items.filter((_, idx) => idx !== i))}
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
                setLineItems((items) => [...items, { name: '', qty: 1, unitPrice: 0, lineTotal: 0 }])
              }
              className="w-full rounded-xl border border-dashed border-slate-300 py-2 text-sm text-slate-500 dark:border-slate-700"
            >
              + Add item
            </button>
          </div>
        </div>

        <button
          type="button"
          disabled={!valid}
          onClick={save}
          className="w-full rounded-xl bg-slate-900 py-3 font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
        >
          {editing ? 'Save changes' : 'Add expense'}
        </button>

        {editing && id && (
          <button
            type="button"
            onClick={() => {
              if (confirm('Delete this expense?')) {
                void deleteExpense(id).then(() => navigate('/expenses'))
              }
            }}
            className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-medium text-red-500 dark:border-red-900/50"
          >
            Delete expense
          </button>
        )}
      </div>
    </div>
  )
}
