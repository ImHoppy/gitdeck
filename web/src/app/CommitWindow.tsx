import { useEffect } from 'react'
import { CommitDialog } from '../features/commit'
import { useSync } from '../features/sync'
import { useWorkspace } from '../features/workspace-tree'
import styles from './App.module.css'

/** The commit dialog alone, in its own window (`?commit=<repoId>`). */
export function CommitWindow({ repoId, workspace: wsName }: { repoId: number; workspace: string }) {
  const { workspace, error, open } = useWorkspace()
  useEffect(() => {
    void open(wsName)
  }, [open, wsName])
  const sync = useSync()
  const repo = workspace?.repos.find((r) => r.id === repoId)
  const name = repo?.name
  useEffect(() => {
    if (name) document.title = `Commit · ${name}`
  }, [name])
  if (!repo) return <div className={styles.message}>{error ?? (workspace ? `No repo ${repoId}` : 'Loading…')}</div>
  return <CommitDialog standalone repoId={repoId} onClose={() => window.close()} onPush={() => void sync.sync(repoId, 'push')} />
}
