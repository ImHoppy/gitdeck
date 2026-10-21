const UNITS = ['B', 'KB', 'MB', 'GB']

export function formatBytes(bytes: number): string {
  let n = Math.abs(bytes)
  let unit = 0
  while (n >= 1024 && unit < UNITS.length - 1) {
    n /= 1024
    unit++
  }
  return `${unit ? n.toFixed(1) : n} ${UNITS[unit]}`
}
