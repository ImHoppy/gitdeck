import { useEffect } from 'react'
import { CommitInfo } from '../features/commit-info'
import { DiffPanel } from '../features/diff'
import { useHistory } from '../features/revision-grid'
import { useWorkspace } from '../features/workspace-tree'
import { usePaneSize } from '../lib/usePaneSize'
import { Resizer } from '../ui/Resizer/Resizer'
import styles from './App.module.css'

type Props = { sha: string; parents: string[]; repoId: number; workspace: string }

/** One commit, its message and its diff at full window size (`?show=<sha>`, a double click in the grid). */
export function CommitDetailWindow({ sha, parents, repoId, workspace: wsName }: Props) {
  const { workspace, error, open } = useWorkspace()
  useEffect(() => {
    void open(wsName)
  }, [open, wsName])
  const repo = workspace?.repos.find((r) => r.id === repoId)
  const history = useHistory(repo ? repoId : null)
  const infoHeight = usePaneSize('detailInfo', 220, 80, 1200)
  const repoName = repo?.name
  useEffect(() => {
    if (repoName) document.title = `${sha.slice(0, 8)} · ${repoName}`
  }, [sha, repoName])

  if (!repo) return <div className={styles.message}>{error ?? (workspace ? `No repo ${repoId}` : 'Loading…')}</div>
  return (
    <div className={styles.detailWindow}>
      <div className={styles.detailInfo} style={{ height: infoHeight.size }}>
        <CommitInfo repoId={repoId} sha={sha} refs={history.info?.refs ?? []} onPick={() => {}} />
      </div>
      <Resizer axis="y" onDrag={infoHeight.drag} onDone={infoHeight.save} />
      <div className={styles.detailDiff}>
        <DiffPanel repoId={repoId} target={{ kind: 'commit', sha, parent: parents[0] ?? null }} title={sha.slice(0, 8)} parents={parents} />
      </div>
    </div>
  )
}
