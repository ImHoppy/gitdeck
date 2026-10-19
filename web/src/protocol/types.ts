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
  lastFetch: LastFetch | null
}

export type WorkspaceSnapshot = { name: string; repos: RepoSnapshot[] }

export type SyncKind = 'fetch' | 'pull' | 'push' | 'sync'

export type RebaseAction = 'continue' | 'skip' | 'abort'

export type SyncOutcome =
  | { kind: 'done' }
  | { kind: 'upToDate' }
  | { kind: 'conflict' }
  | { kind: 'autostashConflict' }
  | { kind: 'authFailed' }
  | { kind: 'skipped'; reason: string }
  | { kind: 'failed'; message: string }

export type LastFetch = { at: number; outcome: SyncOutcome }

export type RepoResult = { id: number; outcome: SyncOutcome; submodulesMoved: string[] }

export type RefKind = 'branch' | 'remote' | 'tag'

export type GitRef = { sha: string; kind: RefKind; name: string; upstream: string | null }

export type HistoryInfo = { key: string; head: string | null; refs: GitRef[]; count: number }

export type GraphSegment = { from: number | null; to: number | null; color: number }

export type GraphRow = { lane: number; color: number; segments: GraphSegment[] }

export type HistoryRow = {
  sha: string
  parents: string[]
  author: string
  email: string
  time: number
  subject: string
  bodyHint: string
  multiline: boolean
  graph: GraphRow
}

export type DiffTarget = { kind: 'worktree' } | { kind: 'index' } | { kind: 'commit'; sha: string; parent: string | null }

export type ChangeKind =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'typeChanged'
  | 'unmerged'
  | 'untracked'

export type ChangedFile = { path: string; oldPath: string | null; kind: ChangeKind }

export type Patch = { text: string; diffId: string }

export type ResetMode = 'soft' | 'mixed' | 'hard'

export type RepoAction =
  | { kind: 'checkout'; branch: string }
  | { kind: 'checkoutRemote'; remoteBranch: string; local: string }
  | { kind: 'checkoutDetached'; sha: string }
  | { kind: 'createBranch'; name: string; at: string; checkout: boolean }
  | { kind: 'renameBranch'; from: string; to: string }
  | { kind: 'deleteBranch'; name: string; force: boolean }
  | { kind: 'deleteRemoteBranch'; remote: string; name: string }
  | { kind: 'merge'; rev: string }
  | { kind: 'rebase'; onto: string }
  | { kind: 'cherryPick'; sha: string }
  | { kind: 'revert'; sha: string }
  | { kind: 'reset'; sha: string; mode: ResetMode }
  | { kind: 'createTag'; name: string; at: string }
  | { kind: 'deleteTag'; name: string }
  | { kind: 'stashPush'; message: string; untracked: boolean }
  | { kind: 'stashApply'; index: number }
  | { kind: 'stashPop'; index: number }
  | { kind: 'stashDrop'; index: number }
  | { kind: 'recordPointers'; paths: string[] }

export type Stash = { index: number; sha: string; time: number; message: string }

export type CommandRecord = { cwd: string; args: string[]; code: number; millis: number; at: number }

export type CommitDetails = {
  sha: string
  author: string
  authorEmail: string
  authorTime: number
  committer: string
  committerEmail: string
  commitTime: number
  parents: string[]
  message: string
}

export type PatchOptions = { context: number; ignoreWhitespace: boolean }

export type TreeEntry = { name: string; kind: 'tree' | 'blob' | 'commit'; size: number | null }

export type FileContent = { binary: boolean; text: string }

export type BlameLine = { sha: string; author: string; time: number; summary: string; text: string }
