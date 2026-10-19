import { useState } from 'react'
import { useWorkspace, WorkspaceTree } from '../features/workspace-tree'
import styles from './App.module.css'

export function App() {
  const { workspace, error, open } = useWorkspace()
  const [selectedId, setSelectedId] = useState<number | null>(null)

  return (
    <div className={styles.layout}>
      <aside className={styles.left}>
        {workspace ? (
          <WorkspaceTree
            workspace={workspace}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRefresh={() => open(workspace.name)}
          />
        ) : (
          <div className={styles.message}>{error ?? 'Loading…'}</div>
        )}
      </aside>
      <main className={styles.main} />
    </div>
  )
}
