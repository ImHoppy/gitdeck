import { useCallback, useEffect, useState } from 'react'
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
import { useWorkspace, WorkspacePicker, WorkspaceTree } from '../features/workspace-tree'
import { useDialogs } from '../ui/Dialog/useDialogs'
import { Resizer } from '../ui/Resizer/Resizer'
import { usePaneSize } from '../lib/usePaneSize'
import { useNarrow } from '../lib/useNarrow'
import type { RepoSnapshot } from '../protocol/types'
import { Icon } from '../ui/Icon/Icon'
import { IconButton } from '../ui/IconButton/IconButton'
import { Menu, type MenuItem } from '../ui/Menu/Menu'
import { Toast } from '../ui/Toast/Toast'
import { pickFolder } from '../lib/pickFolder'
import { loadLastRepo, saveLastRepo } from '../lib/lastRepo'
import styles from './App.module.css'
import { CommitDetailWindow } from './CommitDetailWindow'
import { CommitWindow } from './CommitWindow'
import { CompareWindow } from './CompareWindow'
import { FileHistoryWindow } from './FileHistoryWindow'
import { ReflogWindow } from './ReflogWindow'
import { StatsWindow } from './StatsWindow'
import { RepoView } from './RepoView'
import { StartPage } from '../features/start'
import { useOpenParam } from './useOpenParam'

export function App() {
  const params = new URLSearchParams(location.search)
  const commitId = params.get('commit')
  const reflog = params.get('reflog')
  if (reflog) return <ReflogWindow repoId={Number(reflog)} workspace={params.get('ws') ?? ''} />
  const history = params.get('history')
  if (history) return <FileHistoryWindow path={history} repoId={Number(params.get('repo'))} workspace={params.get('ws') ?? ''} />
  const compare = params.get('compare')
  if (compare) {
    return (
      <CompareWindow
        newest={compare}
        base={params.get('base') || null}
        count={Number(params.get('count'))}
        repoId={Number(params.get('repo'))}
        workspace={params.get('ws') ?? ''}
      />
    )
  }
  const stats = params.get('stats')
  if (stats) return <StatsWindow repoId={Number(stats)} workspace={params.get('ws') ?? ''} />
  const show = params.get('show')
  if (show) {
    const parents = params.get('parents')?.split(',').filter(Boolean) ?? []
    return <CommitDetailWindow sha={show} parents={parents} repoId={Number(params.get('repo'))} workspace={params.get('ws') ?? ''} />
  }
  return commitId ? <CommitWindow repoId={Number(commitId)} workspace={params.get('ws') ?? ''} /> : <Browse />
}

function Browse() {
  const { names, workspace, error, open, close, addRoot, removeRoot, setExcluded, setNested } = useWorkspace()
  const dialogs = useDialogs()
  const treeWidth = usePaneSize('tree', 340, 200, 700)
  const narrow = useNarrow()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showRepo, setShowRepo] = useState(false)
  const pickRepo = useCallback((id: number) => {
    setSelectedId(id)
    setShowRepo(true)
  }, [])
  const [openError, setOpenError] = useState<string | null>(null)
  useOpenParam(workspace, pickRepo, open, setOpenError)
  // back where you left the project; a project of one repo opens straight into it, like Git Extensions
  const openProject = useCallback(
    async (name: string) => {
      const ws = await open(name)
      if (!ws) return
      const last = loadLastRepo(name)
      const repo = ws.repos.find((r) => r.path === last) ?? (ws.repos.length === 1 ? ws.repos[0] : undefined)
      if (repo) pickRepo(repo.id)
      else setSelectedId(null)
    },
    [open, pickRepo],
  )
  const closeProject = () => {
    close()
    setSelectedId(null)
    setShowRepo(false)
  }
  const shown = selectedId !== null && workspace?.repos.some((r) => r.id === selectedId)
  useEffect(() => {
    // RepoView names the repo while one is open
    if (!shown) document.title = workspace ? `${workspace.name} · gitdeck` : 'gitdeck'
  }, [shown, workspace])
  const repoOpen = narrow && showRepo && selectedId !== null

  const addRepo = async () => {
    const path = await dialogs.prompt('Add a repository', 'Folder of a git repository (its submodules come along)', '', pickFolder)
    if (!path) return
    const name = await dialogs.prompt('Workspace', 'Add it to workspace (an existing name or a new one)', workspace?.name ?? 'default')
    if (name) await addRoot(name, path)
  }
  const sync = useSync()
  const selected = workspace?.repos.find((r) => r.id === selectedId)
  const projectName = workspace?.name
  const selectedPath = selected?.path
  useEffect(() => {
    if (projectName && selectedPath) saveLastRepo(projectName, selectedPath)
  }, [projectName, selectedPath])
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
        removeRoot: (path) => workspace && void removeRoot(workspace.name, path),
        setExcluded: (path, excluded) => workspace && void setExcluded(workspace.name, path, excluded),
        nested: repo.parent === null ? (workspace?.nestedRoots ?? []).some((p) => samePath(p, repo.path)) : null,
        setNested: (path, on) => workspace && void setNested(workspace.name, path, on),
      }),
    })

  if (!workspace) {
    return (
      <>
        <StartPage onOpen={openProject} />
        {(openError ?? error) && <Toast tone="bad" title={openError ?? error} onDismiss={() => setOpenError(null)} />}
      </>
    )
  }

  return (
    <div className={`${styles.layout} ${narrow ? styles.narrow : ''} ${repoOpen ? styles.repoOpen : ''}`}>
      <aside className={styles.left} style={narrow ? undefined : { width: treeWidth.size }}>
        {workspace ? (
          <WorkspaceTree
            workspace={workspace}
            selectedId={selectedId}
            onSelect={pickRepo}
            onRefresh={() => open(workspace.name, true)}
            picker={<>
              <IconButton title="Close the project and go back to the start page" onClick={closeProject}>
                <Icon name="close" size={12} />
              </IconButton>
              <WorkspacePicker names={names ?? []} current={workspace.name} onOpen={(n) => void openProject(n)} onAdd={() => void addRepo()} />
            </>}
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
                  <Icon name="pin" />
                  {server.info?.keepRunning ? ' kept' : ''}
                </IconButton>
                <IconButton title="Settings" onClick={() => setSettingsOpen(true)}>
                  <Icon name="settings" />
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
        ) : null}
      </aside>
      {!narrow && <Resizer axis="x" onDrag={treeWidth.drag} onDone={treeWidth.save} />}
      <main className={styles.main}>
        {tree.error && (
          <Toast tone="bad" title={tree.error} onDismiss={tree.clearError} />
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
          <RepoView key={selected.id} repo={selected} workspace={workspace.name} onBack={narrow ? () => setShowRepo(false) : undefined}
            onPush={(id) => void sync.sync(id, 'push')}
          />
        ) : (
          <div className={styles.message}>Select a repo in the tree.</div>
        )}
      </main>
      {menu && <Menu items={menu.items} at={menu.at} onClose={() => setMenu(null)} />}
      {dialogs.element}
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
          githubAvatars={server.info ? { value: server.info.githubAvatars, onChange: server.setGithubAvatars } : null}
          version={server.info?.version ?? null}
          repoId={selected?.id ?? null}
          editor={server.info ? { path: server.info.editor, onSave: server.setEditor } : null}
          git={server.info ? { path: server.info.git, version: server.info.gitVersion, onSave: server.setGit } : null}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}

const samePath = (a: string, b: string) => a.replaceAll('\\', '/').toLowerCase() === b.replaceAll('\\', '/').toLowerCase()
