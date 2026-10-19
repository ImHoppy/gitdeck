import type { ReactNode } from 'react'
import styles from './IconButton.module.css'

type Props = { title: string; disabled?: boolean; onClick: () => void; children: ReactNode }

export function IconButton({ title, disabled, onClick, children }: Props) {
  return (
    <button
      className={styles.button}
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
