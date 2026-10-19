import type { RepoSnapshot } from '../../protocol/types'
import { Badge } from '../../ui/Badge/Badge'

const OPERATION_LABEL = { rebase: 'rebase', merge: 'merge', cherryPick: 'cherry-pick', revert: 'revert' }

export function RepoBadges({ repo }: { repo: RepoSnapshot }) {
  if (repo.excluded) return <Badge tone="muted">⊘ excluded</Badge>
  if (!repo.initialized) return <Badge tone="muted">not initialized</Badge>
  if (repo.error) return <Badge tone="danger" title={repo.error}>⚠ error</Badge>
  const s = repo.state
  if (!s) return null
  const dirty = s.status.unstaged + s.status.untracked
  return (
    <>
      {!!s.tracking.ahead && <Badge tone="ahead">↑{s.tracking.ahead}</Badge>}
      {!!s.tracking.behind && <Badge tone="behind">↓{s.tracking.behind}</Badge>}
      {s.tracking.gone && <Badge tone="danger">gone</Badge>}
      {s.status.staged > 0 && <Badge tone="ahead" title="staged">✓{s.status.staged}</Badge>}
      {dirty > 0 && <Badge tone="dirty" title="changed">✎{dirty}</Badge>}
      {s.status.conflicts > 0 && <Badge tone="danger">✖{s.status.conflicts}</Badge>}
      {s.head.kind === 'detached' && <Badge tone="danger">⚠ detached</Badge>}
      {s.operation && <Badge tone="danger">⚠ {OPERATION_LABEL[s.operation]} in progress</Badge>}
      {fetchFailed(repo) && (
        <Badge tone="danger" title={fetchError(repo)}>
          fetch failed
        </Badge>
      )}
      {repo.pointerDiffers && <Badge tone="muted" title="differs from superproject pointer">+</Badge>}
    </>
  )
}

function fetchFailed(repo: RepoSnapshot) {
  const kind = repo.lastFetch?.outcome.kind
  return kind === 'failed' || kind === 'authFailed'
}

function fetchError(repo: RepoSnapshot) {
  const o = repo.lastFetch?.outcome
  return o?.kind === 'failed' ? o.message : 'authentication needed'
}
