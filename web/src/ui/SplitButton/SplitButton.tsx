import { type ReactNode, useEffect, useRef, useState } from 'react'
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

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <span ref={root} className={styles.split} onClick={(e) => e.stopPropagation()}>
      <button className={styles.main} title={title} disabled={disabled} onClick={onClick}>
        {children}
      </button>
      <button className={styles.arrow} title="More actions" disabled={disabled} onClick={() => setOpen((o) => !o)}>
        ▾
      </button>
      {open && (
        <div className={styles.menu} role="menu">
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
