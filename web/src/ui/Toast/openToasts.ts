import { useSyncExternalStore } from 'react'

/** The dismiss handlers of the toasts on screen, so they can all be cleared at once. */
const open = new Map<symbol, () => void>()
const listeners = new Set<() => void>()
let count = 0

function changed() {
  count = open.size
  listeners.forEach((l) => l())
}

export function trackToast(key: symbol, dismiss: () => void): () => void {
  open.set(key, dismiss)
  changed()
  return () => {
    open.delete(key)
    changed()
  }
}

export function dismissAllToasts() {
  for (const dismiss of [...open.values()]) dismiss()
}

const subscribe = (on: () => void) => {
  listeners.add(on)
  return () => listeners.delete(on)
}

export function useToastCount(): number {
  return useSyncExternalStore(subscribe, () => count)
}
