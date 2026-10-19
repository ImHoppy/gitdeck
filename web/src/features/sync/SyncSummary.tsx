import { Icon } from '../../ui/Icon/Icon'
import type { RepoSnapshot } from '../../protocol/types'
import { IconButton } from '../../ui/IconButton/IconButton'
import { describe, GROUP_LABEL, groupResults } from './outcome'
import styles from './SyncSummary.module.css'
import type { Summary } from './useSync'

type Props = {
  summary: Summary
  repos: RepoSnapshot[]
  onSelect: (repoId: number) => void
  onDismiss: () => void
}

export function SyncSummary({ summary, repos, onSelect, onDismiss }: Props) {
  const names = new Map(repos.map((r) => [r.id, r.pathInParent ?? r.name]))
  return (
    <section className={styles.summary}>
      <header className={styles.header}>
        <strong>{summary.title}</strong>
        <IconButton title="Dismiss" onClick={onDismiss}><Icon name="close" size={12} /></IconButton>
      </header>
      {groupResults(summary.results).map(([group, results]) => (
        <div key={group} className={styles[group]}>
          <div className={styles.group}>
            {GROUP_LABEL[group]} ({results.length})
          </div>
          {results.map((r) => (
            <div key={r.id} className={styles.row} onClick={() => onSelect(r.id)}>
              <span>{names.get(r.id) ?? r.id}</span>
              <span className={styles.detail}>{describe(r.outcome)}</span>
            </div>
          ))}
        </div>
      ))}
    </section>
  )
}
