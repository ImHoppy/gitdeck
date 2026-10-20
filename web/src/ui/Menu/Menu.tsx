import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from '../Icon/Icon'
import styles from './Menu.module.css'

export type MenuItem =
  | { key: string; label: ReactNode; icon?: IconName; checked?: boolean; danger?: boolean; disabled?: boolean; onSelect: () => void }
  | 'separator'

type Props = {
  items: MenuItem[]
  /** A point (context menu) or the element the menu drops from. */
  at: { x: number; y: number } | DOMRect
  onClose: () => void
  /** Clicks here don't count as outside, e.g. the button that toggles the menu. */
  owner?: RefObject<HTMLElement | null>
}

const MARGIN = 4

export function Menu({ items, at, onClose, owner }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  // fixed and clamped to the viewport so scrolling panels and the window edge never clip it
  useLayoutEffect(() => {
    const menu = ref.current?.getBoundingClientRect()
    if (!menu) return
    const [x, top, bottom] = 'x' in at && !('width' in at) ? [at.x, at.y, at.y] : [at.left, at.top - 2, at.bottom + 2]
    const left = Math.min(Math.max(MARGIN, x), window.innerWidth - menu.width - MARGIN)
    const y = bottom + menu.height > window.innerHeight - MARGIN ? Math.max(MARGIN, top - menu.height) : bottom
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
    // scrolling the page moves what the menu points at; scrolling the menu's own list doesn't
    const scroll = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', key)
    window.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('keydown', key)
      window.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose, owner])

  return createPortal(
    <div
      ref={ref}
      className={styles.menu}
      role="menu"
      style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item === 'separator' ? (
          <div key={`sep${i}`} className={styles.separator} />
        ) : (
          <div
            key={item.key}
            role="menuitem"
            aria-disabled={item.disabled}
            className={`${styles.item} ${item.danger ? styles.danger : ''} ${item.disabled ? styles.disabled : ''}`}
            onClick={() => {
              if (item.disabled) return
              onClose()
              item.onSelect()
            }}
          >
            <span className={styles.check}>{item.checked ? '✓' : item.icon ? <Icon name={item.icon} size={13} /> : ''}</span>
            {item.label}
          </div>
        ),
      )}
    </div>,
    document.body,
  )
}
