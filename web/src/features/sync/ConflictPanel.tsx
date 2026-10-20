import type { RebaseAction, RepoSnapshot } from '../../protocol/types'
import { Icon } from '../../ui/Icon/Icon'
import { IconButton } from '../../ui/IconButton/IconButton'
import { Toast } from '../../ui/Toast/Toast'
import styles from './ConflictPanel.module.css'
import { type Conflict, type ConflictKind, useConflictActions } from './useConflicts'

type Props = {
  repo: RepoSnapshot
  files: Conflict[]
  busy: boolean
  onRebase: (action: RebaseAction) => void
}

const KIND: Record<ConflictKind, string> = {
  bothModified: 'both changed',
  bothAdded: 'both added',
  bothDeleted: 'both deleted',
  deletedByUs: 'deleted on mine',
  deletedByThem: 'deleted on theirs',
  addedByUs: 'added on mine',
  addedByThem: 'added on theirs',
}

export function ConflictPanel({ repo, files, busy, onRebase }: Props) {
  const op = repo.state?.operation ?? null
  const opName = op === 'cherryPick' ? 'cherry-pick' : op
  const act = useConflictActions(repo.id)
  // during a rebase git's "ours" is the branch being rebased onto, "theirs" the commit replayed
  const [mine, theirs] = op === 'rebase' ? ['upstream', 'your commit'] : [repo.state?.head.kind === 'branch' ? repo.state.head.name : 'current', 'incoming']
  const disabled = busy || act.busy !== null

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <strong>
          {repo.pathInParent ?? repo.name}: {op ? `${opName} stopped on a conflict` : 'conflicts in the working tree'}
        </strong>
        <span className={styles.actions}>
          <IconButton title="Open the repository in the editor" disabled={disabled} onClick={() => void act.openInEditor()}>
            <Icon name="file" size={12} /> Editor
          </IconButton>
          {op && (
            <>
              <IconButton
                title={files.length ? 'Resolve every file first' : `Go on with the ${opName}`}
                disabled={disabled || files.length > 0}
                onClick={() => onRebase('continue')}
              >
                Continue
              </IconButton>
              {op !== 'merge' && (
                <IconButton title="Drop this commit and go on" disabled={disabled} onClick={() => onRebase('skip')}>
                  Skip
                </IconButton>
              )}
              <IconButton title={`Undo the ${opName}`} disabled={disabled} onClick={() => onRebase('abort')}>
                Abort
              </IconButton>
            </>
          )}
        </span>
      </header>
      {!op && <p className={styles.note}>The autostash could not be applied cleanly; its stash entry is kept. Resolve the files, then drop it.</p>}
      {files.length === 0 ? (
        <p className={styles.note}>All files resolved{op ? `: Continue to finish the ${opName}.` : '.'}</p>
      ) : (
        <ul className={styles.files}>
          {files.map((f) => (
            <li key={f.path} className={styles.file}>
              <span className={styles.path} title={f.path}>
                {f.path}
              </span>
              <span className={styles.kind}>{KIND[f.kind]}</span>
              <span className={styles.actions}>
                <IconButton title={`Keep ${mine}'s version of the whole file`} disabled={disabled} onClick={() => void act.take(f.path, 'ours')}>
                  Use {mine}
                </IconButton>
                <IconButton title={`Keep ${theirs}'s version of the whole file`} disabled={disabled} onClick={() => void act.take(f.path, 'theirs')}>
                  Use {theirs}
                </IconButton>
                <IconButton title="Merge it by hand in the editor (VS Code shows Accept Current / Incoming and its merge editor)" disabled={disabled} onClick={() => void act.openInEditor(f.path)}>
                  <Icon name="file" size={12} /> Editor
                </IconButton>
                <IconButton title="Open git's merge tool (merge.tool in Settings)" disabled={disabled} onClick={() => void act.mergeTool(f.path)}>
                  Merge tool
                </IconButton>
                <IconButton title="Stage the file as it is now: no conflict markers left" disabled={disabled} onClick={() => void act.resolved(f.path)}>
                  <Icon name="checkout" size={12} /> Resolved
                </IconButton>
              </span>
            </li>
          ))}
        </ul>
      )}
      {act.error && <Toast tone="bad" title={act.error} onDismiss={act.clearError} />}
    </section>
  )
}
