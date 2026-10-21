import type { SyncOutcome } from './types'

export type GhAvailability =
  | { kind: 'ready'; login: string }
  | { kind: 'loggedOut' }
  | { kind: 'missing' }
  | { kind: 'failed'; message: string }

export type PrStatus = { enabled: boolean; gh: GhAvailability | null }

export type GithubRepoLink = { id: number; remote: string; repo: string }

export type ListState = 'open' | 'closed' | 'merged'

export type CheckSummary = { passed: number; failed: number; pending: number }

export type PrSummary = {
  number: number
  title: string
  author: string
  headRefName: string
  baseRefName: string
  headRefOid: string
  isDraft: boolean
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null
  checks: CheckSummary
  updatedAt: string
  isCrossRepository: boolean
  headOwner: string | null
  url: string
  reviewRequests: string[]
}

export type PrList = { repo: string; state: ListState; prs: PrSummary[]; at: number; limit: number; complete: boolean }

export type PrCommit = { oid: string; headline: string; authoredDate: string; author: string }

export type PrFile = { path: string; additions: number; deletions: number; changeType: string }

export type Label = { name: string; color: string }

export type PrDetail = {
  id: string
  number: number
  title: string
  body: string
  author: string
  state: PrSummary['state']
  isDraft: boolean
  url: string
  createdAt: string
  updatedAt: string
  headRefName: string
  baseRefName: string
  headRefOid: string
  baseRefOid: string
  headRepo: { owner: string; name: string } | null
  isCrossRepository: boolean
  maintainerCanModify: boolean
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'
  mergeStateStatus: string
  reviewDecision: PrSummary['reviewDecision']
  checks: CheckSummary
  commits: PrCommit[]
  files: PrFile[]
  additions: number
  deletions: number
  labels: Label[]
  reviewRequests: string[]
  mergedAt: string | null
}

export type PrCheck = {
  name: string
  state: string
  bucket: 'pass' | 'fail' | 'pending' | 'skipping' | 'cancel'
  link: string
  workflow: string
  description: string
  startedAt: string | null
  completedAt: string | null
}

export type Reaction = { content: string; count: number }

export type Comment = {
  id: string
  author: string
  body: string
  createdAt: string
  updatedAt: string
  canEdit: boolean
  canDelete: boolean
  reactions: Reaction[]
}

export type ReviewState = 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING'

export type TimelineItem =
  | ({ kind: 'comment' } & Comment)
  | ({ kind: 'review'; state: ReviewState } & Comment)
  | { kind: 'commit'; oid: string; headline: string; author: string; at: string }
  | { kind: 'forcePushed'; actor: string; at: string; before: string | null; after: string | null }
  | { kind: 'event'; event: 'merged' | 'closed' | 'reopened' | 'ready' | 'draft'; actor: string; at: string; commit: string | null }

export type ReviewThread = {
  id: string
  resolved: boolean
  outdated: boolean
  path: string
  line: number | null
  originalLine: number | null
  startLine: number | null
  side: 'LEFT' | 'RIGHT'
  canResolve: boolean
  canUnresolve: boolean
  canReply: boolean
  reviewId: string | null
  diffHunk: string
  comments: Comment[]
}

export type Timeline = { viewer: string; prId: string; viewerCanUpdate: boolean; items: TimelineItem[]; threads: ReviewThread[] }

export type RepoInfo = {
  defaultBranch: string
  rebaseMergeAllowed: boolean
  squashMergeAllowed: boolean
  viewerPermission: string
  deleteBranchOnMerge: boolean
}

export type RefCard = {
  number: number
  title: string
  state: 'open' | 'closed'
  author: string
  isPull: boolean
  merged: boolean
  draft: boolean
  url: string
}

export type RepoMatch = { id: number; name: string; remote: string; origin: boolean }

export type PrFetch = { head: string; mergeBase: string | null; remote: string }

export type DraftThread = { path: string; line: number; side: 'LEFT' | 'RIGHT'; startLine?: number; body: string }

export type ReviewEvent = 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES'

export type Mutation =
  | { kind: 'reply'; threadId: string; body: string }
  | { kind: 'edit'; id: string; body: string }
  | { kind: 'delete'; id: string }
  | { kind: 'resolve'; threadId: string }
  | { kind: 'unresolve'; threadId: string }
  | { kind: 'review'; prId: string; event: ReviewEvent; body: string; threads: DraftThread[] }

export type StateChange = 'close' | 'reopen' | 'ready' | 'draft' | 'updateBranch'

export type MergeMethod = 'rebase' | 'squash'

export type PrHead = {
  number: number
  headRefName: string
  isCrossRepository: boolean
  maintainerCanModify: boolean
  headRepo: string | null
}

export type SwitchOutcome =
  | { kind: 'switched'; branch: string; previous: string | null; stash: string | null }
  | { kind: 'clash'; branch: string; separate: string }
  | { kind: 'dirty' }
  | { kind: 'skipped'; reason: string }
  | { kind: 'failed'; message: string }

export type SwitchedFrom = { previous: string; stash: string | null }

export type CreateResult = { outcome: SyncOutcome; number: number | null }
