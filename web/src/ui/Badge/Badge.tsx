import type { ReactNode } from 'react'
import styles from './Badge.module.css'

export type BadgeTone = 'ahead' | 'behind' | 'dirty' | 'danger' | 'muted'

export function Badge({ tone, title, children }: { tone: BadgeTone; title?: string; children: ReactNode }) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`} title={title}>
      {children}
    </span>
  )
}
