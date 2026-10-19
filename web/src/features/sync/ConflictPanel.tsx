import type { RebaseAction, RepoSnapshot } from '../../protocol/types'
import { IconButton } from '../../ui/IconButton/IconButton'
import styles from './SyncSummary.module.css'

type Props = {
  repo: RepoSnapshot
  files: string[]
  busy: boolean
  onRebase: (action: RebaseAction) => void
}

export function ConflictPanel({ repo, files, busy, onRebase }: Props) {
  const op = repo.state?.operation ?? null
  const opName = op === 'cherryPick' ? 'cherry-pick' : op
  return (
    <section className={styles.summary}>
      <header className={styles.header}>
        <strong>
          {repo.pathInParent ?? repo.name}: {op ? `${opName} stopped on a conflict` : 'conflicts in the working tree'}
        </strong>
        {op && (
          <span>
            <IconButton title="Continue once the files are resolved and staged" disabled={busy} onClick={() => onRebase('continue')}>
              continue
            </IconButton>{' '}
            {op !== 'merge' && (
              <IconButton title="Drop this commit and go on" disabled={busy} onClick={() => onRebase('skip')}>
                skip
              </IconButton>
            )}{' '}
            <IconButton title={`Undo the ${opName}`} disabled={busy} onClick={() => onRebase('abort')}>
              abort
            </IconButton>
          </span>
        )}
      </header>
      {!op && (
        <div className={styles.row}>
          The autostash could not be applied cleanly; its stash entry is kept. Resolve the files, then drop it.
        </div>
      )}
      <div className={`${styles.group} ${styles.conflict}`}>{files.length} conflicted</div>
      {files.map((f) => (
        <div key={f} className={styles.row}>
          {f}
        </div>
      ))}
    </section>
  )
}
