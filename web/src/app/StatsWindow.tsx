import { useEffect } from 'react'
import { StatsPage } from '../features/stats'
import { useServerInfo } from '../features/settings'
import { useWorkspace } from '../features/workspace-tree'
import styles from './App.module.css'

/** Statistics of one repo in a window of its own (`?stats=<repoId>`). */
export function StatsWindow({ repoId, workspace: wsName }: { repoId: number; workspace: string }) {
  const { workspace, error, open } = useWorkspace()
  // reads the server settings, the GitHub avatars switch among them
  useServerInfo()
  useEffect(() => {
    void open(wsName)
  }, [open, wsName])
  const repo = workspace?.repos.find((r) => r.id === repoId)
  const name = repo?.pathInParent ?? repo?.name
  useEffect(() => {
    if (name) document.title = `Statistics · ${name}`
  }, [name])
  if (!repo || !name) return <div className={styles.message}>{error ?? (workspace ? `No repo ${repoId}` : 'Loading…')}</div>
  return <StatsPage repoId={repoId} name={name} />
}
