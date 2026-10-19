export type Head =
  | { kind: 'branch'; name: string }
  | { kind: 'detached'; sha: string }
  | { kind: 'unborn'; name: string }

export type Tracking = { ahead: number | null; behind: number | null; gone: boolean }

export type StatusCounts = { staged: number; unstaged: number; untracked: number; conflicts: number }

export type Operation = 'rebase' | 'merge' | 'cherryPick' | 'revert'

export type RepoState = {
  head: Head
  headSha: string | null
  tracking: Tracking
  status: StatusCounts
  operation: Operation | null
}

export type RepoSnapshot = {
  id: number
  parent: number | null
  path: string
  pathInParent: string | null
  name: string
  recordedSha: string | null
  initialized: boolean
  excluded: boolean
  state: RepoState | null
  pointerDiffers: boolean
  error: string | null
}

export type WorkspaceSnapshot = { name: string; repos: RepoSnapshot[] }
