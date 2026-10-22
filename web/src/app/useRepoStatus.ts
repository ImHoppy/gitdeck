import { useStatusItem } from '../lib/statusBar'
import type { RepoSnapshot } from '../protocol/types'

type At = { x: number; y: number }

type Deps = {
  repo: RepoSnapshot
  onBranchMenu: (at: At) => void
  pull: { busy: boolean; label: string; run: () => void }
  onCommit: () => void
  /** A branch, stash or other command of this repo is running. */
  busy: boolean
}

export function useRepoStatus({ repo, onBranchMenu, pull, onCommit, busy }: Deps) {
  const head = repo.state?.head
  const branch = head?.kind === 'branch' ? head.name : head?.kind === 'detached' ? head.sha.slice(0, 7) : (head?.name ?? null)
  useStatusItem(
    branch
      ? {
          id: 'repo-branch',
          side: 'left',
          order: 50,
          icon: 'branch',
          text: `${repo.pathInParent ?? repo.name}: ${branch}`,
          title: head?.kind === 'detached' ? 'Detached HEAD (click: switch to a branch)' : 'Current branch (click: switch)',
          tone: head?.kind === 'detached' ? 'warn' : 'normal',
          onClick: onBranchMenu,
        }
      : null,
  )
  const t = repo.state?.tracking
  const known = t?.ahead != null && t.behind != null
  useStatusItem({
    id: 'repo-sync',
    side: 'left',
    order: 40,
    icon: 'sync',
    text: known ? `${t.behind}↓ ${t.ahead}↑` : undefined,
    title: known ? `${t.behind} to pull, ${t.ahead} to push (click: ${pull.label})` : `No upstream (click: ${pull.label})`,
    tone: pull.busy ? 'busy' : 'normal',
    onClick: pull.busy ? undefined : pull.run,
  })
  const s = repo.state?.status
  const changes = (s?.staged ?? 0) + (s?.unstaged ?? 0) + (s?.untracked ?? 0)
  useStatusItem({
    id: 'repo-changes',
    side: 'left',
    order: 30,
    icon: 'commit',
    text: String(changes),
    title: `${changes} changed file${changes === 1 ? '' : 's'} (click: commit, Ctrl+Space)`,
    tone: s?.conflicts ? 'bad' : 'normal',
    onClick: onCommit,
  })
  useStatusItem(busy ? { id: 'repo-command', side: 'right', order: 30, tone: 'busy', text: 'Running…', title: 'A git command is running' } : null)
}
