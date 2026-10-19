import { useEffect, useMemo, useRef, useState } from 'react'
import { useDebounced } from '../lib/useDebounced'
import { CommitDialog } from '../features/commit'
import { CommitInfo } from '../features/commit-info'
import { DiffPanel } from '../features/diff'
import { FileTreePanel } from '../features/file-tree'
import { OutputPanel, useCommandLog } from '../features/output'
import { RefsPanel, type RefTarget, useStashes } from '../features/refs-panel'
import { type Commands, commitMenu, refMenu, stashMenu, stashPush, useRepoCommands } from '../features/repo-actions'
import { type GridSelection, RevisionGrid, useHistory } from '../features/revision-grid'
import type { DiffTarget, GitRef, HistoryRow, RepoSnapshot } from '../protocol/types'
import { useDialogs } from '../ui/Dialog/useDialogs'
import { Icon } from '../ui/Icon/Icon'
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

export function RepoView({ repo, onBack }: { repo: RepoSnapshot; onBack?: () => void }) {
  const [filter, setFilter] = useState('')
  const filterBox = useRef<HTMLInputElement>(null)
  const history = useHistory(repo.id, useDebounced(filter.trim(), 250))
  const stashes = useStashes(repo.id)
  const commands = useRepoCommands(repo.id)
  const dialogs = useDialogs()
  const [selection, setSelection] = useState<GridSelection | null>(null)
  const [scrollTo, setScrollTo] = useState<number | null>(null)
  const [ancestry, setAncestry] = useState(false)
  const [committing, setCommitting] = useState(false)
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
        setCommitting(true)
      } else if (e.ctrlKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        filterBox.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [history])
  const highlighted = ancestry && lineage && lineage.sha === selectedSha ? lineage.rows : null
  const [tab, setTab] = useState<'commit' | 'diff' | 'files' | 'output'>('commit')
  const commandLog = useCommandLog()
  const refsWidth = usePaneSize('refs', 200, 120, 500)
  const bottomHeight = usePaneSize('bottom', 300, 100, 2000)
  const [menu, setMenu] = useState<{ items: MenuItem[]; at: { x: number; y: number } } | null>(null)

  const head = repo.state?.head
  const currentBranch = head?.kind === 'branch' ? head.name : null
  const status = repo.state?.status
  const changes = (status?.staged ?? 0) + (status?.unstaged ?? 0) + (status?.untracked ?? 0)
  const refs = useMemo(() => history.info?.refs ?? [], [history.info])
  const ctx = useMemo(() => {
    const cmd: Commands = { run: commands.run, prompt: dialogs.prompt, confirm: dialogs.confirm }
    return { cmd, currentBranch }
  }, [commands.run, dialogs.prompt, dialogs.confirm, currentBranch])

  const pick = async (sha: string) => {
    const index = await history.locate(sha)
    if (index === null) return
    setScrollTo(index)
    const row = history.rows.get(index)
    setSelection({ kind: 'commit', sha, parents: row?.parents ?? [], subject: row?.subject ?? '' })
  }

  const onCommitMenu = (row: HistoryRow, at: { x: number; y: number }) => {
    const branchesHere = refs.filter((r) => r.kind === 'branch' && r.sha === row.sha && r.name !== currentBranch).map((r) => r.name)
    setMenu({ items: commitMenu(ctx, row.sha, branchesHere), at })
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
      <div className={styles.toolbar}>
        {onBack && (
          <IconButton title="Back to the repositories" onClick={onBack}>
            <Icon name="folder" /> Repos
          </IconButton>
        )}
        <strong>{repo.pathInParent ?? repo.name}</strong>
        <IconButton title="Open the commit dialog (Ctrl+Space)" onClick={() => setCommitting(true)}>
          <Icon name="commit" /> Commit ({changes})
        </IconButton>
        <IconButton title="Stash all changes" disabled={changes === 0 || commands.busy} onClick={() => void stashPush(ctx)}>
          <Icon name="stash" /> Stash
        </IconButton>
        <IconButton title="Dim commits that are not ancestors of the selected one" onClick={() => setAncestry(!ancestry)}>
          <Icon name="history" /> {ancestry ? 'ancestry on' : 'ancestry'}
        </IconButton>
        <input
          ref={filterBox}
          className={styles.filter}
          placeholder="Filter: message, author, hash (Ctrl+F)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setFilter('')}
        />
        <CommandStatus busy={commands.busy} last={commands.last} onDismiss={commands.clear} />
      </div>
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
                />
              ) : (
                <div className={styles.message}>Select a row to see its changes.</div>
              )}
            </div>
          </div>
        </div>
      </div>
      {menu && <Menu items={menu.items} at={menu.at} onClose={() => setMenu(null)} />}
      {committing && <CommitDialog repoId={repo.id} onClose={() => setCommitting(false)} />}
      {dialogs.element}
    </div>
  )
}
