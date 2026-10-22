import type { ReactNode } from 'react'
import styles from './Button.module.css'

type Props = { title: string; primary?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }

export function Button({ title, primary, disabled, onClick, children }: Props) {
  return (
    <button className={primary ? `${styles.button} ${styles.primary}` : styles.button} title={title} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}
