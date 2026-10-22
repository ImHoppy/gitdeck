import { useEffect, useRef } from 'react'

const DOUBLE_CLICK_MS = 300

/**
 * With `onDouble`, a click waits until no double click can follow, so a double click runs
 * `onDouble` alone instead of `onClick` first.
 */
export function useClickOrDouble(onClick: (() => void) | undefined, onDouble: (() => void) | undefined) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  if (!onClick || !onDouble) return { onClick, onDoubleClick: onDouble }
  return {
    onClick: () => {
      clearTimeout(timer.current)
      timer.current = setTimeout(onClick, DOUBLE_CLICK_MS)
    },
    onDoubleClick: () => {
      clearTimeout(timer.current)
      onDouble()
    },
  }
}
