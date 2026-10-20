import { useSyncExternalStore } from 'react'

// whether gitd fetches GitHub avatars: a server setting every Avatar reads
let enabled = false
const listeners = new Set<() => void>()

export function setAvatarsEnabled(on: boolean) {
  if (on === enabled) return
  enabled = on
  listeners.forEach((l) => l())
}

export function useAvatarsEnabled(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => enabled,
  )
}

export function avatarUrl(email: string): string {
  return `/avatar?email=${encodeURIComponent(email.trim().toLowerCase())}`
}
