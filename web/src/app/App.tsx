import { useState } from 'react'
import {
  ConflictPanel,
  hasConflicts,
  RepoActions,
  SubmoduleUpdateDialog,
  SyncSummary,
  SyncToolbar,
  useConflicts,
  PULL_ACTIONS,
  useSync,
} from '../features/sync'
import { SettingsPage, useServerInfo, useTheme } from '../features/settings'
import { treeMenu, useTreeCommands } from '../features/repo-actions'
import { useWorkspace, WorkspaceTree } from '../features/workspace-tree'
import type { RepoSnapshot } from '../protocol/types'
import { IconButton } from '../ui/IconButton/IconButton'
import { Menu, type MenuItem } from '../ui/Menu/Menu'
import styles from './App.module.css'
import { RepoView } from './RepoView'

export function App() {
  const { workspace, error, open } = useWorkspace()
  const sync = useSync()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const selected = workspace?.repos.find((r) => r.id === selectedId)
  const conflictFiles = useConflicts(selected)
  const tree = useTreeCommands()
  const theme = useTheme()
  const server = useServerInfo()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [menu, setMenu] = useState<{ items: MenuItem[]; at: { x: number; y: number } } | null>(null)

  const onRepoMenu = (repo: RepoSnapshot, at: { x: number; y: number }) =>
    setMenu({
      at,
      items: treeMenu(repo, {
        open: setSelectedId,
        sync: (id, kind) => void sync.sync(id, kind),
        reveal: (id, what) => void tree.reveal(id, what),
        checkoutTracked: (id) => void tree.checkoutTracked(id),
        submodule: tree.submodule,
        recordPointer: (parentId, path) => void tree.recordPointer(parentId, path),
        refresh: () => workspace && open(workspace.name),
      }),
    })

  return (
    <div className={styles.layout}>
      <aside className={styles.left}>
        {workspace ? (
          <WorkspaceTree
            workspace={workspace}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRefresh={() => open(workspace.name)}
            onRepoMenu={onRepoMenu}
            toolbar={
              <>
                <SyncToolbar
                  running={sync.bulk}
                  pullAction={sync.pullAction}
                  onSetPullAction={sync.setPullAction}
                  onRunAll={sync.syncAll}
                />
                <IconButton
                  title={server.info?.keepRunning ? 'gitd keeps running with no window open' : 'gitd stops after the last window closes'}
                  disabled={!server.info}
                  onClick={() => server.setKeepRunning(!server.info?.keepRunning)}
                >
                  {server.info?.keepRunning ? '📌 kept' : '📌'}
                </IconButton>
                <IconButton title="Settings" onClick={() => setSettingsOpen(true)}>
                  ⚙
                </IconButton>
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
        {tree.error && (
          <div className={styles.banner}>
            {tree.error}
            <IconButton title="Dismiss" onClick={tree.clearError}>
              ✕
            </IconButton>
          </div>
        )}
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
        {selected?.initialized && !selected.excluded ? (
          <RepoView key={selected.id} repo={selected} />
        ) : (
          <div className={styles.message}>Select a repo in the tree.</div>
        )}
      </main>
      {menu && <Menu items={menu.items} at={menu.at} onClose={() => setMenu(null)} />}
      {settingsOpen && (
        <SettingsPage
          theme={{ value: theme.theme, onChange: theme.setTheme, options: [['auto', 'Follow the system'], ['light', 'Light'], ['dark', 'Dark']] }}
          pullAction={{ value: sync.pullAction, onChange: sync.setPullAction, options: PULL_ACTIONS.map((a) => [a.kind, a.label]) }}
          submodules={{
            value: sync.choice,
            onChange: sync.setChoice,
            options: [['ask', 'Ask every time'], ['always', 'Always update'], ['never', 'Never update']],
          }}
          keepRunning={server.info ? { value: server.info.keepRunning, onChange: server.setKeepRunning } : null}
          version={server.info?.version ?? null}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
