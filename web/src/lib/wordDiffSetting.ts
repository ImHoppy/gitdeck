import { useSyncExternalStore } from 'react'
import { loadSetting, saveSetting } from './storedSetting'

// word highlighting in every diff view, switched from the diff toolbar
const KEY = 'gitdeck.diff.words'
let enabled = loadSetting(KEY, ['true', 'false'], 'true') === 'true'
const listeners = new Set<() => void>()

export function setWordDiff(on: boolean) {
  if (on === enabled) return
  enabled = on
  saveSetting(KEY, String(on))
  listeners.forEach((l) => l())
}

export function useWordDiff(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => enabled,
  )
}
