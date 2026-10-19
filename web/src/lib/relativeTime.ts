const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

const format = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "13 minutes ago" from unix seconds. */
export function relativeTime(unixSecs: number, nowMs = Date.now()): string {
  const diff = unixSecs - Math.floor(nowMs / 1000)
  for (const [unit, secs] of UNITS) {
    if (Math.abs(diff) >= secs) return format.format(Math.trunc(diff / secs), unit)
  }
  return 'just now'
}
