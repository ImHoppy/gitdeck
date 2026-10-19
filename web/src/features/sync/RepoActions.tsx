import type { RebaseAction, RepoSnapshot, SyncKind } from '../../protocol/types'
import { IconButton } from '../../ui/IconButton/IconButton'
import { PullButton } from './PullButton'
import type { PullAction } from './pullAction'

type Props = {
  repo: RepoSnapshot
  busy: boolean
  pullAction: PullAction
  onSetPullAction: (a: PullAction) => void
  onSync: (kind: SyncKind) => void
  onRebase: (action: RebaseAction) => void
}

export function RepoActions({ repo, busy, pullAction, onSetPullAction, onSync, onRebase }: Props) {
  const s = repo.state
  if (!s || repo.excluded) return null
  if (s.operation) {
    return (
      <>
        <IconButton title="Continue" disabled={busy} onClick={() => onRebase('continue')}>continue</IconButton>
        {s.operation !== 'merge' && (
          <IconButton title="Skip this commit" disabled={busy} onClick={() => onRebase('skip')}>skip</IconButton>
        )}
        <IconButton title="Abort" disabled={busy} onClick={() => onRebase('abort')}>abort</IconButton>
      </>
    )
  }
  if (s.head.kind !== 'branch') {
    return (
      <IconButton title="Fetch" disabled={busy} onClick={() => onSync('fetch')}>
        ⤓
      </IconButton>
    )
  }
  const { ahead, behind } = s.tracking
  return (
    <>
      <PullButton
        defaultAction={pullAction}
        disabled={busy}
        suffix={busy ? ' …' : ahead || behind ? ` ${behind ?? 0}↓ ${ahead ?? 0}↑` : ''}
        onRun={onSync}
        onSetDefault={onSetPullAction}
      />
      <IconButton title="Push" disabled={busy || !ahead} onClick={() => onSync('push')}>
        ⇡
      </IconButton>
    </>
  )
}
