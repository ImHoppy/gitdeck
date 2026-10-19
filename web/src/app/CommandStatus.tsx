import type { CommandResult } from '../features/repo-actions'
import { Icon } from '../ui/Icon/Icon'
import { IconButton } from '../ui/IconButton/IconButton'
import styles from './App.module.css'

type Props = { busy: boolean; last: CommandResult | null; onDismiss: () => void }

export function CommandStatus({ busy, last, onDismiss }: Props) {
  if (busy) return <span className={styles.status}>running…</span>
  if (!last) return null
  const o = last.outcome
  const text =
    o.kind === 'failed'
      ? `${last.title} failed: ${o.message}`
      : o.kind === 'skipped'
        ? `${last.title} skipped: ${o.reason}`
        : o.kind === 'conflict' || o.kind === 'autostashConflict'
          ? `${last.title} stopped on a conflict`
          : `${last.title}: done`
  const bad = o.kind === 'failed' || o.kind === 'conflict' || o.kind === 'autostashConflict' || o.kind === 'authFailed'
  return (
    <span className={`${styles.status} ${bad ? styles.statusBad : ''}`} title={text}>
      {text}
      <IconButton title="Dismiss" onClick={onDismiss}>
        <Icon name="close" size={11} />
      </IconButton>
    </span>
  )
}
