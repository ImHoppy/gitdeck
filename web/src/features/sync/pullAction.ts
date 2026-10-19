import { loadSetting, saveSetting } from '../../lib/storedSetting'
import type { SyncKind } from '../../protocol/types'

export type PullAction = Exclude<SyncKind, 'push'>

export const PULL_ACTIONS: { kind: PullAction; icon: string; label: string; title: string }[] = [
  { kind: 'pull', icon: '⇣', label: 'Pull (rebase)', title: 'Fetch, then rebase onto the upstream' },
  { kind: 'fetch', icon: '⤓', label: 'Fetch', title: 'Fetch and prune' },
  { kind: 'sync', icon: '⟳', label: 'Sync', title: 'Fetch, rebase if behind, push if ahead' },
]

const KEY = 'gitdeck.pullAction'

export const loadPullAction = () =>
  loadSetting<PullAction>(KEY, PULL_ACTIONS.map((a) => a.kind), 'pull')

export const savePullAction = (a: PullAction) => saveSetting(KEY, a)

export const pullActionInfo = (kind: PullAction) => PULL_ACTIONS.find((a) => a.kind === kind)!
