import { useState } from 'react'
import {
  ConflictPanel,
  hasConflicts,
  RepoActions,
  SubmoduleChoiceSelect,
  SubmoduleUpdateDialog,
  SyncSummary,
  SyncToolbar,
  useConflicts,
  useSync,
} from '../features/sync'
import { useWorkspace, WorkspaceTree } from '../features/workspace-tree'
import styles from './App.module.css'

export function App() {
  const { workspace, error, open } = useWorkspace()
  const sync = useSync()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const selected = workspace?.repos.find((r) => r.id === selectedId)
  const conflictFiles = useConflicts(selected)

  return (
    <div className={styles.layout}>
      <aside className={styles.left}>
        {workspace ? (
          <WorkspaceTree
            workspace={workspace}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRefresh={() => open(workspace.name)}
            toolbar={
              <>
                <SyncToolbar
                  running={sync.bulk}
                  pullAction={sync.pullAction}
                  onSetPullAction={sync.setPullAction}
                  onRunAll={sync.syncAll}
                />
                <SubmoduleChoiceSelect value={sync.choice} onChange={sync.setChoice} />
              </>
            }
            actions={(repo) => (
              <RepoActions
                repo={repo}
                busy={sync.busy.has(repo.id) || sync.bulk !== null}
                pullAction={sync.pullAction}
                onSetPullAction={sync.setPullAction}
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
        {selected && hasConflicts(selected) && (
          <ConflictPanel
            repo={selected}
            files={conflictFiles}
            busy={sync.busy.has(selected.id)}
            onRebase={(action) => sync.rebase(selected.id, action)}
          />
        )}
        {workspace && sync.summary && (
          <SyncSummary
            summary={sync.summary}
            repos={workspace.repos}
            onSelect={setSelectedId}
            onDismiss={sync.dismiss}
          />
        )}
        {workspace && sync.moved.length > 0 && (
          <SubmoduleUpdateDialog moved={sync.moved} repos={workspace.repos} onAnswer={sync.answerMoved} />
        )}
      </main>
    </div>
  )
}
