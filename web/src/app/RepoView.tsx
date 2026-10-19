import { useState } from 'react'
import { CommitDialog } from '../features/commit'
import { DiffPanel } from '../features/diff'
import { type GridSelection, RevisionGrid, useHistory } from '../features/revision-grid'
import type { DiffTarget, RepoSnapshot } from '../protocol/types'
import { IconButton } from '../ui/IconButton/IconButton'
import styles from './App.module.css'

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
  const [selection, setSelection] = useState<GridSelection | null>(null)
  const [committing, setCommitting] = useState(false)
  const status = repo.state?.status
  const changes = (status?.staged ?? 0) + (status?.unstaged ?? 0) + (status?.untracked ?? 0)

  if (history.error) return <div className={styles.message}>{history.error}</div>
  if (!history.info) return <div className={styles.message}>Loading history…</div>
  return (
    <div className={styles.repoView}>
      <div className={styles.toolbar}>
        <strong>{repo.pathInParent ?? repo.name}</strong>
        <IconButton title="Open the commit dialog" onClick={() => setCommitting(true)}>
          ✓ Commit ({changes})
        </IconButton>
      </div>
      <div className={styles.gridPane}>
        <RevisionGrid
          repo={repo}
          info={history.info}
          rows={history.rows}
          ensure={history.ensure}
          selection={selection}
          onSelect={setSelection}
        />
      </div>
      {selection && (
        <div className={styles.bottomPane}>
          <DiffPanel key={JSON.stringify(selection)} repoId={repo.id} target={diffTarget(selection)} title={diffTitle(selection)} />
        </div>
      )}
      {committing && <CommitDialog repoId={repo.id} onClose={() => setCommitting(false)} />}
    </div>
  )
}
