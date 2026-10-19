import { useRef, useState } from 'react'
import { loadNumber, saveSetting } from './storedSetting'

/** A pane size in pixels, clamped and remembered in this browser. */
export function usePaneSize(name: string, initial: number, min: number, max: number) {
  const key = `gitdeck.size.${name}`
  const [size, setSize] = useState(() => loadNumber(key, initial))
  const latest = useRef(size)
  return {
    size,
    drag: (delta: number) =>
      setSize((s) => {
        latest.current = Math.min(max, Math.max(min, s + delta))
        return latest.current
      }),
    save: () => saveSetting(key, String(latest.current)),
  }
}
