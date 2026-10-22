import type { ReactNode } from 'react'
import styles from './Button.module.css'

type Props = { title: string; primary?: boolean; good?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }

export function Button({ title, primary, good, disabled, onClick, children }: Props) {
  const className = [styles.button, primary && styles.primary, good && styles.good].filter(Boolean).join(' ')
  return (
    <button className={className} title={title} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}
