import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDebounced } from '../lib/useDebounced'
import { CommitDialog } from '../features/commit'
import { CommitInfo } from '../features/commit-info'
import { InteractiveRebaseDialog } from '../features/rebase'
import { DiffPanel } from '../features/diff'
import { FileTreePanel } from '../features/file-tree'
import { OutputPanel, useCommandLog } from '../features/output'
import { RefsPanel, type RefTarget, useStashes } from '../features/refs-panel'
import {
  branchMenu,
  type Commands,
  commitMenu,
  commitToolsMenu,
  moreMenu,
  pushMenu,
  refMenu,
  stashMenu,
  stashPush,
  useRepoCommands,
  useRepoTools,
  type ViewOptions,
} from '../features/repo-actions'
import { RemotesDialog } from '../features/remotes'
import { WorktreesDialog } from '../features/worktrees'
import { Toast } from '../ui/Toast/Toast'
import { PullButton, type PullAction } from '../features/sync'
import { SplitButton } from '../ui/SplitButton/SplitButton'
import { Spinner } from '../ui/Spinner/Spinner'
import { Icon } from '../ui/Icon/Icon'
import { RepoToolbar } from './RepoToolbar'
import { commitInWindow } from '../lib/commitWindow'
import { openWindow } from './windows'
import { type GridSelection, HistorySearch, RevisionGrid, type SearchMode, useHistory } from '../features/revision-grid'
import { loadSetting, saveSetting } from '../lib/storedSetting'
import type { DiffTarget, GitRef, HistoryRow, RepoSnapshot } from '../protocol/types'
import { useDialogs } from '../ui/Dialog/useDialogs'
import { IconButton } from '../ui/IconButton/IconButton'
import { Resizer } from '../ui/Resizer/Resizer'
import { usePaneSize } from '../lib/usePaneSize'
import { Menu, type MenuItem } from '../ui/Menu/Menu'
import styles from './App.module.css'
import { CommandStatus } from './CommandStatus'

function diffTarget(s: GridSelection): DiffTarget {
  if (s.kind === 'commit') return { kind: 'commit', sha: s.sha, parent: s.parents[0] ?? null }
  return { kind: s.kind }
}

function diffTitle(s: GridSelection): string {
  if (s.kind === 'worktree') return 'Working directory (unstaged)'
  if (s.kind === 'index') return 'Commit index (staged)'
  return `${s.sha.slice(0, 8)}: ${s.subject}`
}

type Pull = { action: PullAction; setAction: (a: PullAction) => void; busy: boolean; run: (kind: PullAction) => void }
type Props = { repo: RepoSnapshot; workspace: string; onBack?: () => void; onPush: (id: number) => void; pull: Pull }

export function RepoView({ repo, workspace, onBack, onPush, pull }: Props) {
  const [filter, setFilter] = useState('')
  const filterBox = useRef<HTMLInputElement>(null)
  const [searchMode, setSearchMode] = useState<SearchMode>(() => loadSetting('searchMode', ['message', 'content'] as const, 'message'))
  // content search runs git over every diff: wait for a pause in typing
  const query = useDebounced(filter.trim(), searchMode === 'content' ? 600 : 250)
  const [view, setView] = useState<ViewOptions>(() => ({
    currentBranch: loadSetting('viewCurrentBranch', ['1', '0'] as const, '0') === '1',
    firstParent: loadSetting('viewFirstParent', ['1', '0'] as const, '0') === '1',
  }))
  const changeView = (v: ViewOptions) => {
    setView(v)
    saveSetting('viewCurrentBranch', v.currentBranch ? '1' : '0')
    saveSetting('viewFirstParent', v.firstParent ? '1' : '0')
  }
  const history = useHistory(repo.id, query, searchMode === 'content', view)
  const tools = useRepoTools(repo.id)
  const [panel, setPanel] = useState<'remotes' | 'worktrees' | null>(null)
  const stashes = useStashes(repo.id)
  const commands = useRepoCommands(repo.id)
  const dialogs = useDialogs()
  const [selection, setSelection] = useState<GridSelection | null>(null)
  const [scrollTo, setScrollTo] = useState<number | null>(null)
  const [ancestry, setAncestry] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [rebaseBase, setRebaseBase] = useState<string | null>(null)
  const closeCommit = useCallback(() => setCommitting(false), [])
  const [lineage, setLineage] = useState<{ sha: string; rows: ReadonlySet<number> } | null>(null)
  const selectedSha = selection?.kind === 'commit' ? selection.sha : null
  const { ancestors } = history
  useEffect(() => {
    if (!ancestry || !selectedSha) return
    let live = true
    ancestors(selectedSha).then((rows) => live && setLineage({ sha: selectedSha, rows: new Set(rows) }), () => {})
    return () => {
      live = false
    }
  }, [ancestry, selectedSha, ancestors])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault()
        history.reload()
      } else if (e.ctrlKey && e.key === ' ') {
        e.preventDefault()
        openCommit()
      } else if (e.ctrlKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        filterBox.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [history])
  useEffect(() => {
    document.title = `${repo.pathInParent ?? repo.name} · gitdeck`
  }, [repo.pathInParent, repo.name])
  const openCommit = () => (commitInWindow() ? openWindow({ kind: 'commit', repo: repo.id }, workspace) : setCommitting(true))
  const openFileHistory = (path: string) => openWindow({ kind: 'history', repo: repo.id, path }, workspace)
  const highlighted = ancestry && lineage && lineage.sha === selectedSha ? lineage.rows : null
  const [tab, setTab] = useState<'commit' | 'diff' | 'files' | 'output'>('commit')
  const commandLog = useCommandLog()
  const refsWidth = usePaneSize('refs', 150, 100, 500)
  const bottomHeight = usePaneSize('bottom', 300, 100, 2000)
  const [menu, setMenu] = useState<{ items: MenuItem[]; at: { x: number; y: number } } | null>(null)

  const head = repo.state?.head
  const ahead = repo.state?.tracking.ahead
  const currentBranch = head?.kind === 'branch' ? head.name : null
  const refs = useMemo(() => history.info?.refs ?? [], [history.info])
  const remotes = useMemo(() => [...new Set(refs.filter((r) => r.kind === 'remote').map((r) => r.name.split('/')[0]))].sort(), [refs])
  const ctx = useMemo(() => {
    const cmd: Commands = { run: commands.run, prompt: dialogs.prompt, confirm: dialogs.confirm }
    return { cmd, currentBranch, remotes: remotes.length ? remotes : ['origin'] }
  }, [commands.run, dialogs.prompt, dialogs.confirm, currentBranch, remotes])

  const pick = async (sha: string) => {
    const index = await history.locate(sha)
    if (index === null) return
    setScrollTo(index)
    const row = history.rows.get(index)
    setSelection({ kind: 'commit', sha, parents: row?.parents ?? [], subject: row?.subject ?? '' })
  }

  const onCommitMenu = (row: HistoryRow, at: { x: number; y: number }) => {
    const branchesHere = refs.filter((r) => r.kind === 'branch' && r.sha === row.sha && r.name !== currentBranch).map((r) => r.name)
    const interactive: MenuItem = { key: 'rebase-i', label: 'Rebase interactively from here…', icon: 'history', disabled: !currentBranch || row.sha === history.info?.head, onSelect: () => setRebaseBase(row.sha) }
    setMenu({ items: [...commitMenu(ctx, row.sha, branchesHere), 'separator', interactive, 'separator', ...commitToolsMenu(tools, row.sha, row.subject)], at })
  }

  const onRefMenu = (target: RefTarget, at: { x: number; y: number }) =>
    setMenu({ items: target.kind === 'ref' ? refMenu(ctx, target.ref) : stashMenu(ctx, target.stash), at })

  const aheadBehind = (r: GitRef) => {
    if (r.kind !== 'branch' || r.name !== currentBranch) return ''
    const t = repo.state?.tracking
    return t && (t.ahead || t.behind) ? `${t.ahead ?? 0}↑${t.behind ?? 0}↓` : ''
  }

  if (history.error) return <div className={styles.message}>{history.error}</div>
  if (!history.info) return <div className={styles.message}>Loading history…</div>
  return (
    <div className={styles.repoView}>
      <RepoToolbar
        repo={repo}
        busy={commands.busy}
        ancestry={ancestry}
        onBack={onBack}
        onBranchMenu={(at) => setMenu({ items: branchMenu(ctx, refs, history.info?.head ?? null), at })}
        sync={
          <>
            <PullButton defaultAction={pull.action} disabled={pull.busy} suffix={pull.busy ? <Spinner /> : null} onRun={pull.run} onSetDefault={pull.setAction} />
            <SplitButton
              title={ahead ? `Push ${ahead} commit${ahead === 1 ? '' : 's'}` : 'Push'}
              disabled={pull.busy}
              onClick={() => onPush(repo.id)}
              menu={pushMenu(ctx, { hasUpstream: ahead != null, ahead: ahead ?? 0, push: () => onPush(repo.id) })}
            >
              <Icon name="push" />
              {ahead ? ` ${ahead}` : ''}
            </SplitButton>
          </>
        }
        onMoreMenu={(at) =>
          setMenu({
            items: moreMenu({
              view,
              setView: changeView,
              tools,
              bisecting: !!repo.state?.bisecting,
              open: (what) => (what === 'reflog' ? openWindow({ kind: 'reflog', repo: repo.id }, workspace) : setPanel(what)),
            }),
            at,
          })
        }
        onCommit={openCommit}
        onStash={() => void stashPush(ctx)}
        onStats={() => openWindow({ kind: 'stats', repo: repo.id }, workspace)}
        onAncestry={() => setAncestry(!ancestry)}
      >
        <HistorySearch
          inputRef={filterBox}
          value={filter}
          mode={searchMode}
          searching={history.searching}
          count={query ? history.info.count : null}
          onChange={setFilter}
          onMode={(m) => {
            setSearchMode(m)
            saveSetting('searchMode', m)
          }}
        />
        <CommandStatus busy={commands.busy} last={commands.last} onDismiss={commands.clear} />
      </RepoToolbar>
      {repo.state?.bisecting && (
        <div className={styles.bisectBar}>
          <strong>Bisecting</strong>
          <span>Test the checked-out commit, then mark it:</span>
          <IconButton title="This commit has the bug" onClick={() => void tools.bisect('bad', 'HEAD')}>
            Bad
          </IconButton>
          <IconButton title="This commit is fine" onClick={() => void tools.bisect('good', 'HEAD')}>
            Good
          </IconButton>
          <IconButton title="Can't test this one" onClick={() => void tools.bisect('skip', 'HEAD')}>
            Skip
          </IconButton>
          <IconButton title="Stop and go back to where the bisect started" onClick={() => void tools.stopBisect()}>
            Stop
          </IconButton>
        </div>
      )}
      <div className={styles.repoBody}>
        <div className={`${styles.refsPane} ${styles.wideOnly}`} style={{ width: refsWidth.size }}>
          <RefsPanel
            refs={refs}
            stashes={stashes}
            currentBranch={currentBranch}
            aheadBehind={aheadBehind}
            onPick={(sha) => void pick(sha)}
            onContext={onRefMenu}
          />
        </div>
        <span className={styles.wideOnly}>
          <Resizer axis="x" onDrag={refsWidth.drag} onDone={refsWidth.save} />
        </span>
        <div className={styles.historyPane}>
          <div className={styles.gridPane}>
            <RevisionGrid
              repo={repo}
              info={history.info}
              rows={history.rows}
              ensure={history.ensure}
              selection={selection}
              onSelect={setSelection}
              onCommitMenu={onCommitMenu}
              onOpenCommits={(picks) =>
                // from before the oldest pick to the newest: every picked commit's changes are in
                openWindow({ kind: 'compare', repo: repo.id, newest: picks[0].sha, base: picks[picks.length - 1].parents[0] ?? '', count: picks.length }, workspace)
              }
              onOpenCommit={(row) => openWindow({ kind: 'show', repo: repo.id, sha: row.sha, parents: row.parents }, workspace)}
              scrollTo={scrollTo}
              onScrollTo={setScrollTo}
              highlighted={highlighted}
            />
          </div>
          <Resizer axis="y" onDrag={(d) => bottomHeight.drag(-d)} onDone={bottomHeight.save} />
          <div className={styles.bottomPane} style={{ height: bottomHeight.size }}>
            <div className={styles.tabs}>
              <button className={tab === 'commit' ? styles.activeTab : ''} onClick={() => setTab('commit')}>
                Commit
              </button>
              <button className={tab === 'diff' ? styles.activeTab : ''} onClick={() => setTab('diff')}>
                Diff
              </button>
              <button className={tab === 'files' ? styles.activeTab : ''} onClick={() => setTab('files')}>
                File tree
              </button>
              <button className={tab === 'output' ? styles.activeTab : ''} onClick={() => setTab('output')}>
                Output
              </button>
            </div>
            <div className={styles.tabBody}>
              {tab === 'output' ? (
                <OutputPanel records={commandLog} cwd={repo.path} />
              ) : tab === 'files' ? (
                <FileTreePanel
                  repoId={repo.id}
                  sha={selection?.kind === 'commit' ? selection.sha : (history.info.head ?? 'HEAD')}
                  onPick={(sha) => void pick(sha)}
                  onHistory={openFileHistory}
                />
              ) : tab === 'commit' && selection?.kind === 'commit' ? (
                <CommitInfo repoId={repo.id} sha={selection.sha} refs={refs} onPick={(sha) => void pick(sha)} />
              ) : selection ? (
                <DiffPanel
                  key={JSON.stringify(selection)}
                  repoId={repo.id}
                  target={diffTarget(selection)}
                  title={diffTitle(selection)}
                  parents={selection.kind === 'commit' ? selection.parents : undefined}
                  onFileHistory={openFileHistory}
                  onDiffTool={(path) =>
                    void tools.diffTool(
                      path,
                      selection.kind === 'commit'
                        ? { base: selection.parents[0] ?? null, rev: selection.sha }
                        : { staged: selection.kind === 'index' },
                    )
                  }
                />
              ) : (
                <div className={styles.message}>Select a row to see its changes.</div>
              )}
            </div>
          </div>
        </div>
      </div>
      {menu && <Menu items={menu.items} at={menu.at} onClose={() => setMenu(null)} />}
      {committing && (
        <CommitDialog
          repoId={repo.id}
          onClose={closeCommit}
          onPush={() => onPush(repo.id)}
          onPopOut={() => {
            closeCommit()
            openWindow({ kind: 'commit', repo: repo.id }, workspace)
          }}
        />
      )}
      {panel === 'remotes' && <RemotesDialog repoId={repo.id} cmd={ctx.cmd} onClose={() => setPanel(null)} />}
      {panel === 'worktrees' && (
        <WorktreesDialog
          repoId={repo.id}
          cmd={ctx.cmd}
          branches={refs.filter((r) => r.kind === 'branch').map((r) => r.name)}
          onOpen={(path) => window.open(`/?open=${encodeURIComponent(path)}`, `worktree-${path}`, 'popup,width=1400,height=900')}
          onClose={() => setPanel(null)}
        />
      )}
      {tools.result && <Toast tone={tools.result.ok ? 'ok' : 'bad'} title={tools.result.text} onDismiss={tools.clear} autoHide={tools.result.ok ? 6000 : undefined} />}
      {rebaseBase && <InteractiveRebaseDialog repoId={repo.id} base={rebaseBase} onClose={() => setRebaseBase(null)} />}
      {dialogs.element}
    </div>
  )
}
