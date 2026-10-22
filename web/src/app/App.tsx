import { useCallback, useEffect, useRef, useState } from 'react'
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
import { gitNotice, SettingsPage, SetupDialog, type Theme, UpdateToast, useServerInfo, useTheme } from '../features/settings'
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
import { useNavState } from '../lib/navState'
import { openRepoWindow, repoWindowOnDoubleClick } from '../lib/repoWindow'
import { inGitdeckWindow, ZOOM_LEVELS } from '../lib/zoom'
import styles from './App.module.css'
import { CommitDetailWindow } from './CommitDetailWindow'
import { CommitWindow } from './CommitWindow'
import { CompareWindow } from './CompareWindow'
import { FileHistoryWindow } from './FileHistoryWindow'
import { ReflogWindow } from './ReflogWindow'
import { StatsWindow } from './StatsWindow'
import { RepoView } from './RepoView'
import { StartPage } from '../features/start'
import { Jobs } from '../features/jobs'
import { Opening } from './Opening'
import { useOpenParam } from './useOpenParam'
import { ModeToggle } from './ModeToggle'
import { PullsWindow } from './PullsWindow'
import { usePullsMode } from './usePullsMode'
import { Shell } from './Shell'
import { useAppStatus } from './useAppStatus'
import { PullRequestsView } from '../features/pull-requests'
import { openWindow } from './windows'

export function App() {
  const params = new URLSearchParams(location.search)
  const commitId = params.get('commit')
  if (params.get('pulls')) {
    const pr = Number(params.get('pr')) || null
    return <PullsWindow workspace={params.get('ws') ?? ''} repoId={Number(params.get('repo'))} pr={pr} prRepo={params.get('prRepo')} />
  }
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
  const { names, workspace, error, opening, open, close, addRoot, removeRoot, setExcluded, setNested } = useWorkspace()
  const dialogs = useDialogs()
  const treeWidth = usePaneSize('tree', 340, 200, 700)
  const narrow = useNarrow()
  // by path: ids change on every discovery
  const [place, pushPlace, replacePlace] = useNavState<Place>('browse', NOWHERE)
  const go = useCallback(
    (next: Place) => {
      if (next.project !== place.project || next.repo !== place.repo) pushPlace(next)
    },
    [place, pushPlace],
  )
  const selectedId =
    workspace && place.repo && workspace.name === place.project
      ? (workspace.repos.find((r) => samePath(r.path, place.repo!))?.id ?? null)
      : null
  const [showRepo, setShowRepo] = useState(false)
  const pickRepo = useCallback(
    (id: number) => {
      const repo = workspace?.repos.find((r) => r.id === id)
      if (!workspace || !repo) return
      go({ project: workspace.name, repo: repo.path })
      setShowRepo(true)
    },
    [workspace, go],
  )
  const [openError, setOpenError] = useState<string | null>(null)
  useOpenParam(workspace, pickRepo, open, setOpenError)
  const shownProject = useRef<string | null>(null)
  shownProject.current = workspace?.name ?? null
  useEffect(() => {
    const { project, repo } = place
    if (project === shownProject.current) return
    if (!project) {
      close()
      setShowRepo(false)
      return
    }
    void open(project).then((ws) => {
      if (!ws || repo) return
      const last = loadLastRepo(project)
      const found = ws.repos.find((r) => r.path === last) ?? (ws.repos.length === 1 ? ws.repos[0] : undefined)
      if (!found) return
      replacePlace({ project, repo: found.path })
      setShowRepo(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.project])
  const openProject = async (name: string) => go({ project: name, repo: null })
  const closeProject = () => go(NOWHERE)
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
    if (!name) return
    await addRoot(name, path)
    go({ project: name, repo: name === place.project ? place.repo : null })
  }
  const sync = useSync(dialogs.confirm)
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
  const revealRepo = useCallback(() => setShowRepo(true), [])
  const pulls = usePullsMode({ workspace, selectedId, settingKey: server.info?.githubPrs, revealRepo })
  const [pullsVisited, setPullsVisited] = useState(false)
  const toggle = pulls.availability.status?.enabled ? (
    <ModeToggle
      mode={pulls.mode}
      unread={pulls.unread}
      onMode={(m) => {
        if (m === 'pulls') setPullsVisited(true)
        pulls.setMode(m)
      }}
    />
  ) : null
  const prPath = (repoId: number) => workspace?.repos.find((r) => r.id === repoId)?.path ?? null
  const openPulls = (next: Parameters<typeof pulls.open>[0]) => {
    setPullsVisited(true)
    pulls.open(next)
  }
  const [settingsOpen, setSettingsOpen] = useState(false)
  useAppStatus({
    server,
    onSettings: () => {
      server.reload()
      setSettingsOpen(true)
    },
    prs: workspace ? pulls.availability : null,
    onPulls: () => {
      setPullsVisited(true)
      pulls.setMode('pulls')
    },
  })
  const [menu, setMenu] = useState<{ items: MenuItem[]; at: { x: number; y: number } } | null>(null)

  const onRepoMenu = (repo: RepoSnapshot, at: { x: number; y: number }) =>
    setMenu({
      at,
      items: treeMenu(repo, {
        open: pickRepo,
        sync: (id, kind) => void sync.sync(id, kind),
        reveal: (id, what) => void tree.reveal(id, what),
        openInEditor: (id) => void tree.openInEditor(id),
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

  const git = gitNotice(server.info)
  const themeChoice = { value: theme.theme, onChange: theme.setTheme, options: THEMES }
  const [setupOpen, setSetupOpen] = useState(false)
  const setup =
    server.info && (setupOpen || !server.info.setupDone) ? (
      <SetupDialog
        theme={themeChoice}
        server={server}
        onDone={() => {
          setSetupOpen(false)
          server.finishSetup()
        }}
      />
    ) : null
  const updateToast = server.info ? <UpdateToast state={server.info.update} onInstall={server.installUpdate} onRestart={server.restartForUpdate} /> : null
  const settings = settingsOpen ? (
    <SettingsPage
      theme={themeChoice}
      zoom={
        server.info && inGitdeckWindow()
          ? { value: String(server.info.zoom), onChange: (v) => server.setZoom(Number(v)), options: zoomOptions(server.info.zoom) }
          : null
      }
      pullAction={{ value: sync.pullAction, onChange: sync.setPullAction, options: PULL_ACTIONS.map((a) => [a.kind, a.label]) }}
      submodules={{
        value: sync.choice,
        onChange: sync.setChoice,
        options: [['ask', 'Ask every time'], ['always', 'Always update'], ['never', 'Never update']],
      }}
      fetchInterval={
        server.info?.fetchInterval != null
          ? { value: String(server.info.fetchInterval), onChange: (v) => server.setFetchInterval(Number(v)), options: fetchOptions(server.info.fetchInterval) }
          : null
      }
      keepRunning={server.info ? { value: server.info.keepRunning, onChange: server.setKeepRunning } : null}
      githubAvatars={server.info ? { value: server.info.githubAvatars, onChange: server.setGithubAvatars } : null}
      githubPrs={server.info ? { value: server.info.githubPrs, onChange: server.setGithubPrs } : null}
      version={server.info?.version ?? null}
      repoId={selected?.id ?? null}
      editor={server.info ? { path: server.info.editor, onSave: server.setEditor } : null}
      fileManager={server.info ? { path: server.info.fileManager, detected: server.info.fileManagerDetected, onSave: server.setFileManager } : null}
      host={server.host}
      update={server.info ? { version: server.info.version, state: server.info.update, mode: server.info.updates, onCheck: server.checkUpdate, onInstall: server.installUpdate, onRestart: server.restartForUpdate } : null}
      onSetup={() => {
        setSettingsOpen(false)
        setSetupOpen(true)
      }}
      git={server.info ? { path: server.info.git, version: server.info.gitVersion, notice: git, onSave: server.setGit } : null}
      onClose={() => setSettingsOpen(false)}
    />
  ) : null

  // `?open=` is resolved to a project first: the start page would only flash by meanwhile
  if (!workspace && (opening || (new URLSearchParams(location.search).has('open') && !openError && !error))) {
    return <Opening name={opening} />
  }
  if (!workspace) {
    return (
      <Shell>
        <StartPage onOpen={openProject} version={server.info?.version ?? null} cloneWarning={git?.tone === 'warn' ? git.text : null} />
        {(openError ?? error) && <Toast tone="bad" title={openError ?? error} onDismiss={() => setOpenError(null)} />}
        {settings}
        {setup}
        {updateToast}
      </Shell>
    )
  }

  return (
    <Shell>
    <div className={`${styles.layout} ${narrow ? styles.narrow : ''} ${repoOpen ? styles.repoOpen : ''}`}>
      <aside className={styles.left} style={narrow ? undefined : { width: treeWidth.size }}>
        {workspace ? (
          <WorkspaceTree
            workspace={workspace}
            selectedId={selectedId}
            onSelect={pickRepo}
            onOpen={repoWindowOnDoubleClick() ? (repo) => openRepoWindow(repo.path) : undefined}
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
        <Jobs />
        {workspace && sync.summary && (
          <SyncSummary
            summary={sync.summary}
            repos={workspace.repos}
            onSelect={pickRepo}
            onDismiss={sync.dismiss}
          />
        )}
        {workspace && sync.moved.length > 0 && (
          <SubmoduleUpdateDialog moved={sync.moved} repos={workspace.repos} onAnswer={sync.answerMoved} />
        )}
        {(pullsVisited || pulls.mode === 'pulls') && (
          <div className={pulls.mode === 'pulls' ? styles.modePane : styles.hiddenPane}>
            <PullRequestsView
              workspace={workspace}
              availability={pulls.availability}
              place={pulls.place}
              push={pulls.push}
              replace={pulls.replace}
              currentRepoId={selectedId}
              lead={toggle}
              pop={{
                title: 'Open the pull requests in their own window',
                run: () => {
                  if (selectedId !== null) openWindow({ kind: 'pulls', repo: selectedId, pr: pulls.place.pr ?? undefined, prRepo: pulls.place.prRepo ?? undefined }, workspace.name)
                  pulls.setMode('history')
                },
              }}
              onShowInHistory={pulls.showInHistory}
            />
          </div>
        )}
        <div className={pulls.mode === 'pulls' ? styles.hiddenPane : styles.modePane}>
        {selected?.initialized && !selected.excluded ? (
          <RepoView key={selected.id} repo={selected} workspace={workspace.name} onBack={narrow ? () => setShowRepo(false) : undefined}
            lead={toggle}
            prs={
              pulls.availability.ready && pulls.link
                ? {
                    list: pulls.prs,
                    remote: pulls.link.remote,
                    open: (pr) => openPulls({ repo: prPath(selected.id), pr, prRepo: pulls.link?.repo ?? null, tab: 'conversation', create: null }),
                    create: (branch) => openPulls({ repo: prPath(selected.id), pr: null, prRepo: null, create: branch }),
                  }
                : null
            }
            onPush={(id) => void sync.sync(id, 'push')}
            pull={{
              action: sync.pullAction,
              setAction: sync.setPullAction,
              busy: sync.busy.has(selected.id) || sync.bulk !== null,
              run: (kind) => void sync.sync(selected.id, kind),
            }}
          />
        ) : (
          <>
            {toggle && <div className={styles.toolbar}>{toggle}</div>}
            <div className={styles.message}>Select a repo in the tree.</div>
          </>
        )}
        </div>
      </main>
      {menu && <Menu items={menu.items} at={menu.at} onClose={() => setMenu(null)} />}
      {dialogs.element}
    </div>
    {settings}
    {setup}
    {updateToast}
    </Shell>
  )
}

type Place = { project: string | null; repo: string | null }

const NOWHERE: Place = { project: null, repo: null }

const samePath = (a: string, b: string) => a.replaceAll('\\', '/').toLowerCase() === b.replaceAll('\\', '/').toLowerCase()

const THEMES: [Theme, string][] = [['auto', 'Follow the system'], ['light', 'Light'], ['dark', 'Dark']]

function zoomOptions(current: number): [string, string][] {
  const all = ZOOM_LEVELS.includes(current) ? ZOOM_LEVELS : [...ZOOM_LEVELS, current].sort((a, b) => a - b)
  return all.map((l) => [String(l), `${Math.round(l * 100)}%`])
}

const FETCH_MINUTES = [0, 1, 2, 5, 10, 15, 30, 60]

function fetchOptions(current: number): [string, string][] {
  const all = FETCH_MINUTES.includes(current) ? FETCH_MINUTES : [...FETCH_MINUTES, current].sort((a, b) => a - b)
  return all.map((m) => [String(m), m === 0 ? 'Off' : m === 1 ? 'Every minute' : `Every ${m} minutes`])
}
