import { useMemo, useState } from 'react'
import { CommitDialog } from '../features/commit'
import { DiffPanel } from '../features/diff'
import { RefsPanel, type RefTarget, useStashes } from '../features/refs-panel'
import { type Commands, commitMenu, refMenu, stashMenu, stashPush, useRepoCommands } from '../features/repo-actions'
import { type GridSelection, RevisionGrid, useHistory } from '../features/revision-grid'
import type { DiffTarget, GitRef, HistoryRow, RepoSnapshot } from '../protocol/types'
import { useDialogs } from '../ui/Dialog/useDialogs'
import { IconButton } from '../ui/IconButton/IconButton'
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

export function RepoView({ repo }: { repo: RepoSnapshot }) {
  const history = useHistory(repo.id)
  const stashes = useStashes(repo.id)
  const commands = useRepoCommands(repo.id)
  const dialogs = useDialogs()
  const [selection, setSelection] = useState<GridSelection | null>(null)
  const [scrollTo, setScrollTo] = useState<number | null>(null)
  const [committing, setCommitting] = useState(false)
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
        <strong>{repo.pathInParent ?? repo.name}</strong>
        <IconButton title="Open the commit dialog" onClick={() => setCommitting(true)}>
          ✓ Commit ({changes})
        </IconButton>
        <IconButton title="Stash all changes" disabled={changes === 0 || commands.busy} onClick={() => void stashPush(ctx)}>
          Stash
        </IconButton>
        <CommandStatus busy={commands.busy} last={commands.last} onDismiss={commands.clear} />
      </div>
      <div className={styles.repoBody}>
        <div className={styles.refsPane}>
          <RefsPanel
            refs={refs}
            stashes={stashes}
            currentBranch={currentBranch}
            aheadBehind={aheadBehind}
            onPick={(sha) => void pick(sha)}
            onContext={onRefMenu}
          />
        </div>
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
            />
          </div>
          {selection && (
            <div className={styles.bottomPane}>
              <DiffPanel key={JSON.stringify(selection)} repoId={repo.id} target={diffTarget(selection)} title={diffTitle(selection)} />
            </div>
          )}
        </div>
      </div>
      {menu && <Menu items={menu.items} at={menu.at} onClose={() => setMenu(null)} />}
      {committing && <CommitDialog repoId={repo.id} onClose={() => setCommitting(false)} />}
      {dialogs.element}
    </div>
  )
}
