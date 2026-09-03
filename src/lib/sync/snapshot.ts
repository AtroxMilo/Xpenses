/**
 * A "snapshot" is the full local dataset as JSON, minus device-local settings.
 * It is what gets encrypted and pushed to the cloud, and what a pull replaces
 * the local data with.
 */

import { db, exportAll, importAll } from '../../db/db'
import type { Setting } from '../../db/schema'
import { sha256Hex } from './crypto'

/**
 * Settings that must never leave this device:
 *  - `sync.*` — sync bookkeeping (passphrase, account/device ids, markers).
 *
 * `ai.*` (bring-your-own AI key / provider / model) IS synced on purpose, so
 * every device on the account shares one key. It travels inside the
 * passphrase-encrypted blob — same protection as the expense data itself.
 */
export function isDeviceLocalSetting(key: string): boolean {
  return key.startsWith('sync.')
}

export async function buildSnapshot(): Promise<string> {
  const parsed = JSON.parse(await exportAll()) as { settings?: Setting[] }
  parsed.settings = (parsed.settings ?? []).filter((s) => !isDeviceLocalSetting(s.key))
  return JSON.stringify(parsed)
}

export async function applySnapshot(json: string): Promise<void> {
  const preserved = (await db.settings.toArray()).filter((s) => isDeviceLocalSetting(s.key))
  await importAll(json)
  if (preserved.length) await db.settings.bulkPut(preserved)
}

export function hashSnapshot(json: string): Promise<string> {
  return sha256Hex(json)
}

export async function hasLocalData(): Promise<boolean> {
  const [e, b, g] = await Promise.all([
    db.expenses.count(),
    db.budgets.count(),
    db.goals.count(),
  ])
  return e + b + g > 0
}
