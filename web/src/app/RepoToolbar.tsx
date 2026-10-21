import type { ReactNode } from 'react'
import type { RepoSnapshot } from '../protocol/types'
import { DropButton } from '../ui/DropButton/DropButton'
import { Icon } from '../ui/Icon/Icon'
import { IconButton } from '../ui/IconButton/IconButton'
import styles from './App.module.css'

type At = { x: number; y: number }

type Props = {
  repo: RepoSnapshot
  busy: boolean
  ancestry: boolean
  onBack?: () => void
  lead?: ReactNode
  onBranchMenu: (at: At) => void
  /** Pull and push of this repo, next to its branch. */
  sync: ReactNode
  onMoreMenu: (at: At) => void
  onCommit: () => void
  onStash: () => void
  onStats: () => void
  onAncestry: () => void
  /** The search box and command status, which own their state. */
  children: ReactNode
}

export function RepoToolbar({ repo, busy, ancestry, onBack, lead, onBranchMenu, sync, onMoreMenu, onCommit, onStash, onStats, onAncestry, children }: Props) {
  const head = repo.state?.head
  const status = repo.state?.status
  const changes = (status?.staged ?? 0) + (status?.unstaged ?? 0) + (status?.untracked ?? 0)
  const branchLabel = head?.kind === 'branch' ? head.name : head?.kind === 'detached' ? `detached ${head.sha.slice(0, 7)}` : (head?.name ?? '…')

  return (
    <div className={styles.toolbar}>
      {lead}
      {onBack && (
        <IconButton title="Back to the repositories" onClick={onBack}>
          <Icon name="folder" /> Repos
        </IconButton>
      )}
      <strong>{repo.pathInParent ?? repo.name}</strong>
      <DropButton icon="branch" label={branchLabel} title="Current branch: click to switch" danger={head?.kind === 'detached'} onOpen={onBranchMenu} />
      {sync}
      <IconButton title="Open the commit dialog (Ctrl+Space)" onClick={onCommit}>
        <Icon name="commit" /> Commit ({changes})
      </IconButton>
      <IconButton title="Stash all changes" disabled={changes === 0 || busy} onClick={onStash}>
        <Icon name="stash" /> Stash
      </IconButton>
      <IconButton title="Statistics of this repository (new window)" onClick={onStats}>
        <Icon name="chart" /> Statistics
      </IconButton>
      <IconButton title="Dim commits that are not ancestors of the selected one" onClick={onAncestry}>
        <Icon name="history" /> {ancestry ? 'ancestry on' : 'ancestry'}
      </IconButton>
      <DropButton icon="settings" label="More" title="View options, remotes, worktrees, reflog, patches" onOpen={onMoreMenu} />
      {children}
    </div>
  )
}
