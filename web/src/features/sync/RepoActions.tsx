import type { RebaseAction, RepoSnapshot, SyncKind } from '../../protocol/types'
import { IconButton } from '../../ui/IconButton/IconButton'

type Props = {
  repo: RepoSnapshot
  busy: boolean
  onSync: (kind: SyncKind) => void
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
  if (s.operation) return null
  const fetch = (
    <IconButton title="Fetch" disabled={busy} onClick={() => onSync('fetch')}>
      ⤓
    </IconButton>
  )
  if (s.head.kind !== 'branch') return fetch
  const { ahead, behind } = s.tracking
  return (
    <>
      {fetch}
      <IconButton title="Pull (rebase)" disabled={busy || !behind} onClick={() => onSync('pull')}>
        ⇣
      </IconButton>
      <IconButton title="Push" disabled={busy || !ahead} onClick={() => onSync('push')}>
        ⇡
      </IconButton>
      <IconButton title="Sync: fetch, rebase if behind, push if ahead" disabled={busy} onClick={() => onSync('sync')}>
        {busy ? '…' : '⟳'}
        {ahead || behind ? ` ${behind ?? 0}↓ ${ahead ?? 0}↑` : ''}
      </IconButton>
    </>
  )
}
