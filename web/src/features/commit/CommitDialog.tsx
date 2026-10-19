import { useState } from 'react'
import type { ChangedFile, DiffTarget } from '../../protocol/types'
import { Icon } from '../../ui/Icon/Icon'
import { IconButton } from '../../ui/IconButton/IconButton'
import { FileList, PatchView, useDiffFiles, usePatch } from '../diff'
import styles from './CommitDialog.module.css'
import { useCommitActions } from './useCommitActions'

const WORKTREE: DiffTarget = { kind: 'worktree' }
const INDEX: DiffTarget = { kind: 'index' }

type Picked = { side: 'worktree' | 'index'; path: string }

export function CommitDialog({ repoId, onClose }: { repoId: number; onClose: () => void }) {
  const unstaged = useDiffFiles(repoId, WORKTREE)
  const staged = useDiffFiles(repoId, INDEX)
  const actions = useCommitActions(repoId)
  const [picked, setPicked] = useState<Picked | null>(null)
  const [message, setMessage] = useState('')
  const [amend, setAmend] = useState(false)

  const list = picked?.side === 'index' ? staged.files : unstaged.files
  const file: ChangedFile | null = list?.find((f) => f.path === picked?.path) ?? null
  const target = picked?.side === 'index' ? INDEX : WORKTREE
  const patch = usePatch(repoId, target, file, list)

  const paths = (files: ChangedFile[] | null) => (files ?? []).map((f) => f.path)
  const canCommit = !actions.busy && message.trim() !== '' && ((staged.files?.length ?? 0) > 0 || amend)

  const toggleAmend = async (on: boolean) => {
    setAmend(on)
    if (on && message.trim() === '') setMessage(await actions.lastMessage())
  }

  const commit = async () => {
    if (!canCommit) return
    if (await actions.commit(message, amend)) {
      setMessage('')
      setAmend(false)
      onClose()
    }
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog} role="dialog" aria-label="Commit">
        <header className={styles.header}>
          <strong>Commit</strong>
          <IconButton title="Close" onClick={onClose}>
            <Icon name="close" size={12} />
          </IconButton>
        </header>
        <div className={styles.body}>
          <div className={styles.lists}>
            <div className={styles.listHeader}>
              Unstaged ({unstaged.files?.length ?? 0})
              <IconButton title="Stage all" disabled={actions.busy || !unstaged.files?.length} onClick={() => actions.stage(paths(unstaged.files))}>
                ⇊ stage all
              </IconButton>
            </div>
            <div className={styles.list}>
              <FileList
                files={unstaged.files ?? []}
                selected={picked?.side === 'worktree' ? picked.path : null}
                onSelect={(f) => setPicked({ side: 'worktree', path: f.path })}
                action={{ label: <Icon name="pull" size={12} />, title: 'Stage', run: (f) => actions.stage([f.path]) }}
              />
            </div>
            <div className={styles.listHeader}>
              Staged ({staged.files?.length ?? 0})
              <IconButton title="Unstage all" disabled={actions.busy || !staged.files?.length} onClick={() => actions.unstage(paths(staged.files))}>
                ⇈ unstage all
              </IconButton>
            </div>
            <div className={styles.list}>
              <FileList
                files={staged.files ?? []}
                selected={picked?.side === 'index' ? picked.path : null}
                onSelect={(f) => setPicked({ side: 'index', path: f.path })}
                action={{ label: <Icon name="push" size={12} />, title: 'Unstage', run: (f) => actions.unstage([f.path]) }}
              />
            </div>
          </div>
          <div className={styles.right}>
            <div className={styles.diff}>
              {patch?.patch && file && <PatchView repoId={repoId} file={file} patch={patch.patch} side={picked?.side ?? null} />}
            </div>
            <textarea
              className={styles.message}
              placeholder="Commit message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) void commit()
              }}
            />
            <div className={styles.footer}>
              {actions.error && <span className={styles.error}>{actions.error}</span>}
              <label>
                <input type="checkbox" checked={amend} onChange={(e) => void toggleAmend(e.target.checked)} /> Amend
              </label>
              <IconButton title="Commit (Ctrl+Enter)" disabled={!canCommit} onClick={() => void commit()}>
                {amend ? 'Amend commit' : 'Commit'}
              </IconButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
