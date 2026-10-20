import type { ReactNode } from 'react'
import { Icon, type IconName } from '../Icon/Icon'
import styles from './DropButton.module.css'

type Props = {
  icon: IconName
  label: ReactNode
  title: string
  danger?: boolean
  /** Where the menu should drop from: just under the button. */
  onOpen: (at: { x: number; y: number }) => void
}

/** A toolbar button that opens a menu ("main ▾", "Push ▾", "More ▾"). */
export function DropButton({ icon, label, title, danger, onOpen }: Props) {
  return (
    <button
      className={`${styles.button} ${danger ? styles.danger : ''}`}
      title={title}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        onOpen({ x: r.left, y: r.bottom + 2 })
      }}
    >
      <span className={styles.icon}>
        <Icon name={icon} size={13} />
      </span>
      <span className={styles.label}>{label}</span>
      <svg className={styles.caret} width="10" height="10" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3.5 6 8 10.5 12.5 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </button>
  )
}
