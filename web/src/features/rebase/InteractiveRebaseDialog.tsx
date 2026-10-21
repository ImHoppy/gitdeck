import { useEffect } from 'react'
import { IconButton } from '../../ui/IconButton/IconButton'
import { PageHeader } from '../../ui/PageHeader/PageHeader'
import { Select } from '../../ui/Select/Select'
import { Spinner } from '../../ui/Spinner/Spinner'
import styles from './InteractiveRebase.module.css'
import { type Step, type TodoItem, useInteractiveRebase } from './useInteractiveRebase'

const STEPS = [
  ['pick', 'pick'],
  ['reword', 'reword'],
  ['squash', 'squash'],
  ['fixup', 'fixup'],
  ['drop', 'drop'],
] as const

const HELP: Record<Step, string> = {
  pick: 'keep the commit',
  reword: 'keep it with a new message',
  squash: 'join into the commit above, messages joined',
  fixup: 'join into the commit above, its message dropped',
  drop: 'remove the commit and its changes',
}

type Props = { repoId: number; base: string; onClose: () => void }

/** Git Extensions' "Rebase interactively": the commits after `base`, oldest on top, to rearrange. */
export function InteractiveRebaseDialog({ repoId, base, onClose }: Props) {
  const r = useInteractiveRebase(repoId, base)
  const todo = r.todo

  const update = (i: number, patch: Partial<TodoItem>) => todo && r.setTodo(todo.map((t, k) => (k === i ? { ...t, ...patch } : t)))
  const move = (i: number, by: number) => {
    if (!todo || i + by < 0 || i + by >= todo.length) return
    const next = [...todo]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    r.setTodo(next)
  }

  const start = async () => {
    // a conflict leaves the rebase open: the conflict panel takes over from here
    if (await r.run()) onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label="Rebase interactively">
        <PageHeader title={`Rebase interactively onto ${base.slice(0, 8)}`} onClose={onClose} />
        <p className={styles.hint}>Oldest commit on top. Squash and fixup join a commit into the one above it.</p>
        {r.merges && <p className={styles.warn}>Merge commits in this range are flattened: their branches' commits are replayed one by one.</p>}
        <div className={styles.list}>
          {!todo ? (
            <Spinner />
          ) : todo.length === 0 ? (
            <p className={styles.hint}>No commits after this one on the current branch.</p>
          ) : (
            todo.map((t, i) => (
              <div key={t.sha} className={`${styles.row} ${t.step === 'drop' ? styles.dropped : ''}`}>
                <span className={styles.moves}>
                  <button title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                    ▲
                  </button>
                  <button title="Move down" disabled={i === todo.length - 1} onClick={() => move(i, 1)}>
                    ▼
                  </button>
                </span>
                <Select value={t.step} title={HELP[t.step]} options={STEPS} onChange={(step) => update(i, { step })} />
                <code className={styles.sha}>{t.sha.slice(0, 8)}</code>
                {t.step === 'reword' ? (
                  <input className={styles.message} value={t.message} autoFocus onChange={(e) => update(i, { message: e.target.value })} />
                ) : (
                  <span className={styles.subject} title={t.subject}>
                    {t.subject}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
        <footer className={styles.footer}>
          {r.error && <span className={styles.error}>{r.error}</span>}
          <IconButton title="Cancel" onClick={onClose}>
            Cancel
          </IconButton>
          <IconButton title="Rewrite the history as listed" disabled={!todo?.length || r.busy} onClick={() => void start()}>
            {r.busy ? <Spinner /> : 'Start rebase'}
          </IconButton>
        </footer>
      </div>
    </div>
  )
}
