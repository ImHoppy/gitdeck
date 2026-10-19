export function loadSetting<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return allowed.find((a) => a === v) ?? fallback
  } catch {
    return fallback
  }
}

export function saveSetting(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage blocked: the value lasts for this page only
  }
}

export function loadNumber(key: string, fallback: number): number {
  try {
    const v = Number(localStorage.getItem(key))
    return localStorage.getItem(key) !== null && Number.isFinite(v) ? v : fallback
  } catch {
    return fallback
  }
}
