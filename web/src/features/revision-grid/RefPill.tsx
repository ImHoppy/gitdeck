import { Icon } from '../../ui/Icon/Icon'
import type { Pill } from './refPills'
import styles from './RevisionGrid.module.css'

export function RefPill({ pill, tracking }: { pill: Pill; tracking?: string }) {
  if (pill.kind === 'tag') {
    return (
      <span className={`${styles.pill} ${styles.tag}`} title={`tag ${pill.name}`}>
        <Icon name="tag" size={10} />
        {pill.name}
      </span>
    )
  }
  if (pill.kind === 'remote') return <span className={`${styles.pill} ${styles.remote}`}>{pill.name}</span>
  return (
    <span className={`${styles.pill} ${styles.branch} ${pill.head ? styles.headPill : ''}`} title={pill.gone ? 'upstream gone' : undefined}>
      {pill.head && '▶ '}
      {pill.name}
      {pill.remote && <span className={styles.nestled}>{pill.remote}</span>}
      {pill.diverged && (
        <span className={`${styles.nestled} ${styles.virtual}`} title={`differs from ${pill.diverged}`}>
          {pill.diverged}
          {tracking ? ` ${tracking}` : ''}
        </span>
      )}
      {pill.gone && <span className={styles.nestled}>gone</span>}
    </span>
  )
}
