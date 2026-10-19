import type { TouchEvent } from 'react'

const HOLD_MS = 500
const SLOP_PX = 10

/** Touch handlers that call `onHold` after a still press; iOS never fires `contextmenu` for one. */
export function longPress(onHold: (at: { x: number; y: number }) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let start = { x: 0, y: 0 }
  const cancel = () => clearTimeout(timer)
  return {
    onTouchStart: (e: TouchEvent) => {
      const t = e.touches[0]
      start = { x: t.clientX, y: t.clientY }
      cancel()
      timer = setTimeout(() => onHold(start), HOLD_MS)
    },
    onTouchMove: (e: TouchEvent) => {
      const t = e.touches[0]
      if (Math.abs(t.clientX - start.x) > SLOP_PX || Math.abs(t.clientY - start.y) > SLOP_PX) cancel()
    },
    onTouchEnd: cancel,
    onTouchCancel: cancel,
  }
}
