import type { RebaseAction, RepoSnapshot } from '../../protocol/types'
import { IconButton } from '../../ui/IconButton/IconButton'

type Props = {
  repo: RepoSnapshot
  busy: boolean
  onSync: () => void
  onRebase: (action: RebaseAction) => void
}

export function RepoActions({ repo, busy, onSync, onRebase }: Props) {
  const s = repo.state
  if (!s || repo.excluded) return null
  if (s.operation === 'rebase') {
    return (
      <>
        <IconButton title="Continue rebase" disabled={busy} onClick={() => onRebase('continue')}>continue</IconButton>
        <IconButton title="Skip this commit" disabled={busy} onClick={() => onRebase('skip')}>skip</IconButton>
        <IconButton title="Abort rebase" disabled={busy} onClick={() => onRebase('abort')}>abort</IconButton>
      </>
    )
  }
  if (s.operation || s.head.kind !== 'branch') return null
  const { ahead, behind } = s.tracking
  const counts = ahead || behind ? ` ${behind ?? 0}↓ ${ahead ?? 0}↑` : ''
  return (
    <IconButton title="Sync: fetch, rebase if behind, push if ahead" disabled={busy} onClick={onSync}>
      {busy ? '…' : '⟳'}
      {counts}
    </IconButton>
  )
}
