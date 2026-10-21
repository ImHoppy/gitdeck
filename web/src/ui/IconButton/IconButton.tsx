import type { ReactNode } from 'react'
import styles from './IconButton.module.css'

type Props = { title: string; disabled?: boolean; active?: boolean; onClick: () => void; children: ReactNode }

export function IconButton({ title, disabled, active, onClick, children }: Props) {
  return (
    <button
      className={active ? `${styles.button} ${styles.active}` : styles.button}
      title={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {children}
    </button>
  )
}
