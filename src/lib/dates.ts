import type { Period } from '../db/schema'

export interface Range {
  /** inclusive ISO date */
  start: string
  /** inclusive ISO date */
  end: string
  label: string
}

export function toISODate(d: Date): string {
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 10)
}

export function todayISO(): string {
  return toISODate(new Date())
}

/**
 * Parses a "YYYY-MM-DD" string (tolerating a trailing time suffix, e.g. from
 * legacy/imported data) into a LOCAL-midnight Date. `new Date(isoString)`
 * parses date-only strings as UTC midnight, which silently shifts the
 * calendar day by one for anyone west of UTC once local-timezone math is
 * applied on top — every read of a stored date string should go through
 * this instead.
 */
function parseISODate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Monday-based start of week. */
function startOfWeek(d: Date): Date {
  const x = new Date(d)
  const day = (x.getDay() + 6) % 7 // 0 = Monday
  x.setDate(x.getDate() - day)
  x.setHours(0, 0, 0, 0)
  return x
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

const WEEK_FMT = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const MONTH_FMT = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })

/**
 * Returns the current and previous ranges for the given period.
 * `offset` shifts backwards in whole periods (0 = current, 1 = previous, ...).
 */
export function periodRange(period: Period, offset = 0): Range {
  const now = new Date()
  if (period === 'weekly') {
    const start = startOfWeek(now)
    start.setDate(start.getDate() - offset * 7)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    return {
      start: toISODate(start),
      end: toISODate(end),
      label: `${WEEK_FMT.format(start)} – ${WEEK_FMT.format(end)}`,
    }
  }
  const start = startOfMonth(now)
  start.setMonth(start.getMonth() - offset)
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0)
  return {
    start: toISODate(start),
    end: toISODate(end),
    label: MONTH_FMT.format(start),
  }
}

export function inRange(isoDate: string, range: Range): boolean {
  return isoDate >= range.start && isoDate <= range.end
}

/** Number of day-buckets in a range, for trend charts. */
export function daysInRange(range: Range): string[] {
  const out: string[] = []
  const d = parseISODate(range.start)
  const end = parseISODate(range.end)
  while (d <= end) {
    out.push(toISODate(d))
    d.setDate(d.getDate() + 1)
  }
  return out
}

export function shortDay(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric' }).format(
    parseISODate(iso),
  )
}

export function friendlyDate(iso: string): string {
  const today = todayISO()
  if (iso.slice(0, 10) === today) return 'Today'
  const y = new Date()
  y.setDate(y.getDate() - 1)
  if (iso.slice(0, 10) === toISODate(y)) return 'Yesterday'
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'short' }).format(
    parseISODate(iso),
  )
}
