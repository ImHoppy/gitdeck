import type { ReactNode } from 'react'
import styles from './Dialog.module.css'

type Props = { title: string; children: ReactNode; actions: ReactNode }

export function Dialog({ title, children, actions }: Props) {
  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={title}>
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.body}>{children}</div>
        <div className={styles.actions}>{actions}</div>
      </div>
    </div>
  )
}
