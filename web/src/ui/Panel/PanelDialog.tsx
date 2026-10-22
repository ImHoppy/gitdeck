import { type ReactNode, useEffect } from 'react'
import { isMac } from '../../lib/platform'
import { Icon } from '../Icon/Icon'
import { IconButton } from '../IconButton/IconButton'
import styles from './PanelDialog.module.css'

type Props = { title: string; onClose: () => void; actions?: ReactNode; children: ReactNode }

/** A modal for managing a list (remotes, worktrees): a header with actions, a scrolling body. */
export function PanelDialog({ title, onClose, actions, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // a confirmation or menu on top takes the Escape for itself
      if (e.key === 'Escape' && document.querySelectorAll('[aria-modal="true"]').length <= 1 && !document.querySelector('[role="menu"]')) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const close = (
    <IconButton title="Close (Esc)" onClick={onClose}>
      <Icon name="close" size={12} />
    </IconButton>
  )
  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={title}>
        <header className={styles.header}>
          {isMac ? (
            <span className={styles.actions}>
              {close}
              <strong>{title}</strong>
            </span>
          ) : (
            <strong>{title}</strong>
          )}
          <span className={styles.actions}>
            {actions}
            {!isMac && close}
          </span>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  )
}
