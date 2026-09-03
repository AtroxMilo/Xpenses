import { useState } from 'react'
import { useSync } from '../hooks/useSync'
import { Card, SectionTitle } from './ui'

const btn =
  'rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium disabled:opacity-40 dark:border-slate-700'

function ago(ts: number | null): string {
  if (!ts) return 'never'
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 45) return 'just now'
  if (s < 90) return 'a minute ago'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86400)} d ago`
}

export function SyncCard() {
  const sync = useSync()
  const [pass, setPass] = useState('')
  const busy = sync.status === 'syncing'

  async function doConnect() {
    if (pass.trim().length < 8) return
    try {
      await sync.connect(pass.trim())
    } finally {
      setPass('')
    }
  }

  return (
    <>
      <SectionTitle>Account &amp; sync</SectionTitle>
      <Card className="space-y-3">
        {!sync.connected ? (
          <>
            <p className="text-xs text-slate-400">
              Connect this device to sync expenses across your phone and laptop. Your data is
              encrypted with the passphrase before it leaves the browser.
            </p>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Passphrase
              </span>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="A long, unique phrase"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <p className="text-xs text-amber-600 dark:text-amber-500">
              Pick a long, unique phrase — it is the only key to your cloud data and cannot be
              reset. Use the exact same phrase on every device.
            </p>
            <button
              type="button"
              onClick={() => void doConnect()}
              disabled={busy || pass.trim().length < 8}
              className={btn}
            >
              {busy ? 'Connecting…' : 'Connect'}
            </button>
            {sync.error === 'bad-passphrase' && (
              <p className="text-xs text-red-500">That passphrase doesn’t match the cloud data.</p>
            )}
            {sync.error === 'network' && (
              <p className="text-xs text-red-500">Couldn’t reach the sync server.</p>
            )}
          </>
        ) : (
          <>
            <p className="text-xs text-slate-400">
              Synced {ago(sync.lastSyncedAt)}
              {sync.deviceId && ` · this device ${sync.deviceId.slice(0, 8)}`}
              {busy && ' · syncing…'}
            </p>

            {sync.conflict && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300">
                This device and the cloud both changed since the last sync. Pick which one to
                keep:
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void sync.forcePull()}
                    disabled={busy}
                    className={btn}
                  >
                    Use cloud
                  </button>
                  <button
                    type="button"
                    onClick={() => void sync.forcePush()}
                    disabled={busy}
                    className={btn}
                  >
                    Use this device
                  </button>
                </div>
              </div>
            )}

            {sync.error === 'bad-passphrase' && (
              <p className="text-xs text-red-500">
                The passphrase on this device doesn’t match the cloud data. Disconnect and
                reconnect with the right phrase.
              </p>
            )}
            {sync.error === 'auth' && (
              <p className="text-xs text-red-500">Session expired — disconnect and reconnect.</p>
            )}
            {sync.error === 'network' && (
              <p className="text-xs text-red-500">Couldn’t reach the sync server.</p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void sync.syncNow()}
                disabled={busy}
                className={btn}
              >
                Sync now
              </button>
              <button
                type="button"
                onClick={() => void sync.forcePush()}
                disabled={busy}
                className={btn}
              >
                Force push
              </button>
              <button
                type="button"
                onClick={() => void sync.forcePull()}
                disabled={busy}
                className={btn}
              >
                Force pull
              </button>
              <button
                type="button"
                onClick={() => void sync.disconnect()}
                disabled={busy}
                className="rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-500 disabled:opacity-40 dark:border-red-900/50"
              >
                Disconnect
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Force push overwrites the cloud with this device. Force pull replaces this device
              with the cloud copy.
            </p>
          </>
        )}
      </Card>
    </>
  )
}
