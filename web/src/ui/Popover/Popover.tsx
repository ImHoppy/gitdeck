import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  /** A point (context menu) or the element the panel drops from. */
  at: { x: number; y: number } | DOMRect
  onClose: () => void
  /** Clicks here don't count as outside, e.g. the button that toggles the panel. */
  owner?: RefObject<HTMLElement | null>
  className: string
  role?: string
  children: ReactNode
}

const MARGIN = 4

/** A floating panel under a button or at a point; outside clicks, Escape and scrolling close it. */
export function Popover({ at, onClose, owner, className, role, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  // fixed and clamped to the viewport so scrolling panels and the window edge never clip it
  useLayoutEffect(() => {
    const panel = ref.current?.getBoundingClientRect()
    if (!panel) return
    const [x, top, bottom] = 'x' in at && !('width' in at) ? [at.x, at.y, at.y] : [at.left, at.top - 2, at.bottom + 2]
    const left = Math.min(Math.max(MARGIN, x), window.innerWidth - panel.width - MARGIN)
    const y = bottom + panel.height > window.innerHeight - MARGIN ? Math.max(MARGIN, top - panel.height) : bottom
    setPos({ left, top: y })
  }, [at])

  useEffect(() => {
    const outside = (e: MouseEvent) => {
      const t = e.target as Node
      if (!ref.current?.contains(t) && !owner?.current?.contains(t)) onClose()
    }
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    // the user scrolling the page moves what the panel points at; scrolling the panel's own list
    // doesn't, nor does a panel resetting its scroll when it loads (a scroll event, no wheel)
    const scroll = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', key)
    window.addEventListener('wheel', scroll, true)
    window.addEventListener('touchmove', scroll, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('keydown', key)
      window.removeEventListener('wheel', scroll, true)
      window.removeEventListener('touchmove', scroll, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose, owner])

  return createPortal(
    <div
      ref={ref}
      className={className}
      role={role}
      style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </div>,
    document.body,
  )
}
