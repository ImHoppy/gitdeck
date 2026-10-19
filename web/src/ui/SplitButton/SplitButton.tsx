import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import styles from './SplitButton.module.css'

export type MenuItem = { key: string; label: ReactNode; checked?: boolean; onSelect: () => void } | 'separator'

type Props = {
  title: string
  disabled?: boolean
  onClick: () => void
  menu: MenuItem[]
  children: ReactNode
}

export function SplitButton({ title, disabled, onClick, menu, children }: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLSpanElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  // fixed position, kept inside the viewport, so neither the window edge nor a scrolling panel cuts it
  useLayoutEffect(() => {
    if (!open || !root.current || !menuRef.current) return
    const anchor = root.current.getBoundingClientRect()
    const menu = menuRef.current.getBoundingClientRect()
    const margin = 4
    const left = Math.min(Math.max(margin, anchor.left), window.innerWidth - menu.width - margin)
    const below = anchor.bottom + 2
    const top = below + menu.height > window.innerHeight - margin ? Math.max(margin, anchor.top - menu.height - 2) : below
    setPos({ left, top })
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const dismiss = () => setOpen(false)
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
    }
  }, [open])

  return (
    <span ref={root} className={styles.split} onClick={(e) => e.stopPropagation()}>
      <button className={styles.main} title={title} disabled={disabled} onClick={onClick}>
        {children}
      </button>
      <button
        className={styles.arrow}
        title="More actions"
        disabled={disabled}
        onClick={() => {
          setPos(null)
          setOpen((o) => !o)
        }}
      >
        ▾
      </button>
      {open && (
        <div
          ref={menuRef}
          className={styles.menu}
          role="menu"
          style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}
        >
          {menu.map((item, i) =>
            item === 'separator' ? (
              <div key={`sep${i}`} className={styles.separator} />
            ) : (
              <div
                key={item.key}
                role="menuitem"
                className={styles.item}
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
              >
                <span className={styles.check}>{item.checked ? '✓' : ''}</span>
                {item.label}
              </div>
            ),
          )}
        </div>
      )}
    </span>
  )
}
