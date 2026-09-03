/** Thin fetch wrappers over the Worker sync API. All calls send the session cookie. */

import type { EncryptedBlob } from './crypto'

export interface RemoteBackup {
  updatedAt: number
  deviceId: string
  blob: EncryptedBlob
}

const opts: RequestInit = { credentials: 'include' }

export async function createSession(accountId: string): Promise<void> {
  const res = await fetch('/api/session', {
    ...opts,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId }),
  })
  if (!res.ok) throw new Error(`session failed (${res.status})`)
}

export async function deleteSession(): Promise<void> {
  await fetch('/api/session', { ...opts, method: 'DELETE' })
}

export async function getSessionState(): Promise<boolean> {
  try {
    const res = await fetch('/api/session', opts)
    if (!res.ok) return false
    return Boolean(((await res.json()) as { connected?: boolean }).connected)
  } catch {
    return false
  }
}

/** `null` when the cloud has no backup yet (HTTP 204). */
export async function fetchBackup(): Promise<RemoteBackup | null> {
  const res = await fetch('/api/backup', opts)
  if (res.status === 204) return null
  if (res.status === 401) throw new SyncAuthError()
  if (!res.ok) throw new Error(`fetch backup failed (${res.status})`)
  return (await res.json()) as RemoteBackup
}

export interface PutResult {
  ok: boolean
  /** On success: the new server timestamp. On conflict: the current server timestamp. */
  updatedAt: number | null
  conflict: boolean
}

export async function putBackup(input: {
  baseUpdatedAt: number | null
  deviceId: string
  blob: EncryptedBlob
}): Promise<PutResult> {
  const res = await fetch('/api/backup', {
    ...opts,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (res.status === 401) throw new SyncAuthError()
  if (res.status === 409) {
    const body = (await res.json()) as { updatedAt: number | null }
    return { ok: false, updatedAt: body.updatedAt ?? null, conflict: true }
  }
  if (!res.ok) throw new Error(`put backup failed (${res.status})`)
  const body = (await res.json()) as { updatedAt: number }
  return { ok: true, updatedAt: body.updatedAt, conflict: false }
}

export class SyncAuthError extends Error {
  constructor() {
    super('cloud session expired')
    this.name = 'SyncAuthError'
  }
}
