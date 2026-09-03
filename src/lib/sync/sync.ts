/**
 * Cloud sync orchestration: whole-document backup blob, last-write-wins.
 *
 * The local dataset is snapshotted, encrypted with the passphrase, and pushed to
 * the Worker. A pull decrypts the cloud copy and — when it is safe — replaces the
 * local data with it. When both sides changed since the last sync we stop and
 * surface a conflict for the user to resolve with Force push / Force pull.
 */

import { db, getSetting, setSetting, uid } from '../../db/db'
import { BadPassphraseError, decryptJSON, deriveAccountId, encryptJSON } from './crypto'
import {
  createSession,
  deleteSession,
  fetchBackup,
  getSessionState,
  putBackup,
  type RemoteBackup,
  SyncAuthError,
} from './api'
import {
  applySnapshot,
  buildSnapshot,
  hashSnapshot,
  hasLocalData,
  isDeviceLocalSetting,
} from './snapshot'

const K = {
  enabled: 'sync.enabled',
  passphrase: 'sync.passphrase',
  accountId: 'sync.accountId',
  deviceId: 'sync.deviceId',
  serverUpdatedAt: 'sync.lastServerUpdatedAt',
  localHash: 'sync.lastLocalHash',
  syncedAt: 'sync.lastSyncedAt',
} as const

const DEBOUNCE_MS = 5000

// ---- transient state (not persisted) -------------------------------------

export type SyncStatus = 'idle' | 'syncing' | 'error'
export type SyncErrorKind = 'bad-passphrase' | 'auth' | 'network' | null

export interface SyncState {
  status: SyncStatus
  conflict: boolean
  error: SyncErrorKind
}

let state: SyncState = { status: 'idle', conflict: false, error: null }
const listeners = new Set<() => void>()

export function getSyncState(): SyncState {
  return state
}

export function subscribeSyncState(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function set(patch: Partial<SyncState>): void {
  state = { ...state, ...patch }
  for (const cb of listeners) cb()
}

// ---- helpers -----------------------------------------------------------

const numOrNull = (s: string): number | null => (s === '' ? null : Number(s))

async function isEnabled(): Promise<boolean> {
  return (await getSetting(K.enabled, '')) === '1'
}

async function passphrase(): Promise<string> {
  return getSetting(K.passphrase, '')
}

async function deviceId(): Promise<string> {
  let id = await getSetting(K.deviceId, '')
  if (!id) {
    id = uid()
    await setSetting(K.deviceId, id)
  }
  return id
}

async function saveMarkers(serverUpdatedAt: number, localHash: string): Promise<void> {
  await Promise.all([
    setSetting(K.serverUpdatedAt, String(serverUpdatedAt)),
    setSetting(K.localHash, localHash),
    setSetting(K.syncedAt, String(Date.now())),
  ])
}

function reportError(err: unknown): void {
  if (err instanceof BadPassphraseError) set({ status: 'error', error: 'bad-passphrase' })
  else if (err instanceof SyncAuthError) set({ status: 'error', error: 'auth' })
  else set({ status: 'error', error: 'network' })
}

// ---- serialise all sync operations ----------------------------------------

let chain: Promise<unknown> = Promise.resolve()
function run<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn)
  chain = next.catch(() => undefined)
  return next
}

// ---- core operations ----------------------------------------------------

async function applyRemote(remote: RemoteBackup, plaintext: string): Promise<void> {
  await applySnapshot(plaintext)
  const hash = await hashSnapshot(await buildSnapshot())
  await saveMarkers(remote.updatedAt, hash)
  set({ status: 'idle', conflict: false, error: null })
}

async function pushInner(force: boolean): Promise<void> {
  if (!(await isEnabled())) return
  set({ status: 'syncing', error: null })

  const snapshot = await buildSnapshot()
  const hash = await hashSnapshot(snapshot)
  const lastHash = await getSetting(K.localHash, '')
  if (!force && hash === lastHash) {
    set({ status: 'idle' })
    return
  }

  const pass = await passphrase()
  const blob = await encryptJSON(pass, snapshot)
  const id = await deviceId()
  let base = numOrNull(await getSetting(K.serverUpdatedAt, ''))

  let res = await putBackup({ baseUpdatedAt: base, deviceId: id, blob })
  if (res.conflict && force) {
    // Overwrite whatever is there: rebase onto the current server timestamp.
    const remote = await fetchBackup()
    base = remote?.updatedAt ?? null
    res = await putBackup({ baseUpdatedAt: base, deviceId: id, blob })
  }
  if (res.conflict || res.updatedAt == null) {
    set({ status: 'idle', conflict: true })
    return
  }
  await saveMarkers(res.updatedAt, hash)
  set({ status: 'idle', conflict: false, error: null })
}

async function pullInner(force: boolean): Promise<void> {
  if (!(await isEnabled())) return
  set({ status: 'syncing', error: null })

  const remote = await fetchBackup()
  if (!remote) {
    if (await hasLocalData()) {
      await pushInner(true)
    } else {
      set({ status: 'idle' })
    }
    return
  }

  const plaintext = await decryptJSON(await passphrase(), remote.blob)
  const lastServer = numOrNull(await getSetting(K.serverUpdatedAt, ''))
  const lastHash = await getSetting(K.localHash, '')
  const currentHash = await hashSnapshot(await buildSnapshot())

  if (!force && remote.updatedAt === lastServer) {
    // Already have this version; refresh the "synced at" stamp.
    await saveMarkers(remote.updatedAt, lastHash || currentHash)
    set({ status: 'idle', error: null })
    return
  }

  const localClean = lastHash !== '' && currentHash === lastHash
  if (force || localClean) {
    await applyRemote(remote, plaintext)
    return
  }
  set({ status: 'idle', conflict: true })
}

// ---- public API -------------------------------------------------------

export async function connect(pass: string): Promise<void> {
  return run(async () => {
    set({ status: 'syncing', conflict: false, error: null })
    try {
      const accountId = await deriveAccountId(pass)
      await createSession(accountId)
      await Promise.all([
        setSetting(K.passphrase, pass),
        setSetting(K.accountId, accountId),
        setSetting(K.enabled, '1'),
        setSetting(K.serverUpdatedAt, ''),
        setSetting(K.localHash, ''),
      ])
      await deviceId()

      const remote = await fetchBackup()
      if (!remote) {
        await pushInner(true)
        return
      }
      if (!(await hasLocalData())) {
        const plaintext = await decryptJSON(pass, remote.blob)
        await applyRemote(remote, plaintext)
        return
      }
      // Both this device and the cloud hold data — let the user pick.
      await decryptJSON(pass, remote.blob) // validates the passphrase early
      set({ status: 'idle', conflict: true })
    } catch (err) {
      reportError(err)
      throw err
    }
  })
}

export async function disconnect(): Promise<void> {
  return run(async () => {
    await deleteSession()
    await db.settings.where('key').startsWith('sync.').delete()
    set({ status: 'idle', conflict: false, error: null })
  })
}

export function syncNow(): Promise<void> {
  return run(async () => {
    try {
      await pullInner(false)
      if (!state.conflict && state.status !== 'error') await pushInner(false)
    } catch (err) {
      reportError(err)
    }
  })
}

export function forcePush(): Promise<void> {
  return run(async () => {
    try {
      await pushInner(true)
    } catch (err) {
      reportError(err)
    }
  })
}

export function forcePull(): Promise<void> {
  return run(async () => {
    try {
      await pullInner(true)
    } catch (err) {
      reportError(err)
    }
  })
}

// ---- auto sync -------------------------------------------------------

let autoInited = false
let debounceTimer: ReturnType<typeof setTimeout> | undefined

function schedulePush(): void {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    void run(async () => {
      try {
        await pushInner(false)
      } catch (err) {
        reportError(err)
      }
    })
  }, DEBOUNCE_MS)
}

export async function initAutoSync(): Promise<void> {
  if (autoInited) return
  autoInited = true

  // Keep the transient state in step with whether we're connected at all.
  if (!(await isEnabled())) {
    void getSessionState() // no-op warm-up; nothing to do while disconnected
  }

  for (const table of [db.expenses, db.lineItems, db.budgets, db.goals]) {
    table.hook('creating', () => schedulePush())
    table.hook('updating', () => schedulePush())
    table.hook('deleting', () => schedulePush())
  }

  // Synced settings (AI key/provider/model, default period) ride along too, so
  // setting the key on one device reaches the others without waiting for an
  // expense edit. `sync.*` bookkeeping writes are skipped to avoid a push loop.
  const onSettingChange = (key: unknown) => {
    if (typeof key === 'string' && !isDeviceLocalSetting(key)) schedulePush()
  }
  db.settings.hook('creating', (primKey) => onSettingChange(primKey))
  db.settings.hook('updating', (_mods, primKey) => onSettingChange(primKey))

  window.addEventListener('online', () => void syncNow())

  if (await isEnabled()) {
    void run(async () => {
      try {
        await pullInner(false)
      } catch (err) {
        reportError(err)
      }
    })
  }
}
