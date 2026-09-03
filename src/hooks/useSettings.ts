import { useLiveQuery } from 'dexie-react-hooks'
import { db, setSetting } from '../db/db'
import type { Period } from '../db/schema'

const PERIOD_KEY = 'period'

export function usePeriod(): [Period, (p: Period) => void] {
  const period = useLiveQuery(async () => {
    const row = await db.settings.get(PERIOD_KEY)
    return (row?.value as Period) ?? 'monthly'
  }, [], 'monthly' as Period)

  return [period, (p: Period) => void setSetting(PERIOD_KEY, p)]
}
