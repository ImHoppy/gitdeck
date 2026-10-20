import { useEffect } from 'react'
import { DiffPanel } from '../features/diff'
import { useWorkspace } from '../features/workspace-tree'
import styles from './App.module.css'

type Props = { newest: string; base: string | null; count: number; repoId: number; workspace: string }

/** The changes of several picked commits together (`?compare=`, Enter on a multi-selection). */
export function CompareWindow({ newest, base, count, repoId, workspace: wsName }: Props) {
  const { workspace, error, open } = useWorkspace()
  useEffect(() => {
    void open(wsName)
  }, [open, wsName])
  const repo = workspace?.repos.find((r) => r.id === repoId)
  const span = `${base ? base.slice(0, 8) : 'root'}..${newest.slice(0, 8)}`
  const repoName = repo?.name
  useEffect(() => {
    if (repoName) document.title = `${count} commits · ${repoName}`
  }, [count, repoName])

  if (!repo) return <div className={styles.message}>{error ?? (workspace ? `No repo ${repoId}` : 'Loading…')}</div>
  return (
    <div className={styles.detailWindow}>
      <div className={styles.compareHeader}>
        <strong>{count} commits</strong> <span>changes from {span}</span>
      </div>
      <div className={styles.detailDiff}>
        <DiffPanel repoId={repoId} target={{ kind: 'commit', sha: newest, parent: base }} title={`${count} commits (${span})`} />
      </div>
    </div>
  )
}
