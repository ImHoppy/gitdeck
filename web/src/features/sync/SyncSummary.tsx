import type { RepoSnapshot } from '../../protocol/types'
import { Toast } from '../../ui/Toast/Toast'
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
  const groups = groupResults(summary.results)
  const bad = groups.some(([g]) => g === 'failed' || g === 'conflict')
  return (
    <Toast tone={bad ? 'bad' : 'ok'} title={<strong>{summary.title}</strong>} onDismiss={onDismiss} autoHide={bad ? undefined : 6000}>
      {groups.map(([group, results]) => (
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
    </Toast>
  )
}
