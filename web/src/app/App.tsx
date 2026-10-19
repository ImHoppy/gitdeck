import { useState } from 'react'
import { RepoActions, SyncSummary, SyncToolbar, useSync } from '../features/sync'
import { useWorkspace, WorkspaceTree } from '../features/workspace-tree'
import styles from './App.module.css'

export function App() {
  const { workspace, error, open } = useWorkspace()
  const sync = useSync()
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
            toolbar={<SyncToolbar running={sync.bulk} onRunAll={sync.syncAll} />}
            actions={(repo) => (
              <RepoActions
                repo={repo}
                busy={sync.busy.has(repo.id) || sync.bulk !== null}
                onSync={(kind) => sync.sync(repo.id, kind)}
                onRebase={(action) => sync.rebase(repo.id, action)}
              />
            )}
          />
        ) : (
          <div className={styles.message}>{error ?? 'Loading…'}</div>
        )}
      </aside>
      <main className={styles.main}>
        {workspace && sync.summary && (
          <SyncSummary
            summary={sync.summary}
            repos={workspace.repos}
            onSelect={setSelectedId}
            onDismiss={sync.dismiss}
          />
        )}
      </main>
    </div>
  )
}
