import { useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import {
  connect,
  disconnect,
  forcePull,
  forcePush,
  getSyncState,
  subscribeSyncState,
  type SyncState,
  syncNow,
} from '../lib/sync/sync'

const KEYS = {
  enabled: 'sync.enabled',
  deviceId: 'sync.deviceId',
  syncedAt: 'sync.lastSyncedAt',
} as const

export interface UseSync extends SyncState {
  connected: boolean
  deviceId: string
  lastSyncedAt: number | null
  connect: (passphrase: string) => Promise<void>
  disconnect: () => Promise<void>
  syncNow: () => Promise<void>
  forcePush: () => Promise<void>
  forcePull: () => Promise<void>
}

export function useSync(): UseSync {
  const transient = useSyncExternalStore(subscribeSyncState, getSyncState, getSyncState)

  const rows = useLiveQuery(
    () => db.settings.bulkGet([KEYS.enabled, KEYS.deviceId, KEYS.syncedAt]),
    [],
  )
  const connected = rows?.[0]?.value === '1'
  const deviceId = rows?.[1]?.value ?? ''
  const syncedRaw = rows?.[2]?.value
  const lastSyncedAt = syncedRaw ? Number(syncedRaw) : null

  return {
    ...transient,
    connected,
    deviceId,
    lastSyncedAt,
    connect,
    disconnect,
    syncNow,
    forcePush,
    forcePull,
  }
}
