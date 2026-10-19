import { type ReactNode, useRef, useState } from 'react'
import { Menu, type MenuItem } from '../Menu/Menu'
import styles from './SplitButton.module.css'

export type { MenuItem }

type Props = {
  title: string
  disabled?: boolean
  onClick: () => void
  menu: MenuItem[]
  children: ReactNode
}

export function SplitButton({ title, disabled, onClick, menu, children }: Props) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const root = useRef<HTMLSpanElement>(null)

  return (
    <span ref={root} className={styles.split} onClick={(e) => e.stopPropagation()}>
      <button className={styles.main} title={title} disabled={disabled} onClick={onClick}>
        {children}
      </button>
      <button
        className={styles.arrow}
        title="More actions"
        disabled={disabled}
        onClick={() => setAnchor((a) => (a ? null : (root.current?.getBoundingClientRect() ?? null)))}
      >
        ▾
      </button>
      {anchor && <Menu items={menu} at={anchor} owner={root} onClose={() => setAnchor(null)} />}
    </span>
  )
}
