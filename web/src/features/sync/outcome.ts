import type { RepoResult, SyncOutcome } from '../../protocol/types'

export type OutcomeGroup = 'conflict' | 'failed' | 'done' | 'upToDate' | 'skipped'

export const GROUP_LABEL: Record<OutcomeGroup, string> = {
  conflict: 'conflict',
  failed: 'failed',
  done: 'done',
  upToDate: 'up to date',
  skipped: 'skipped',
}

export function groupOf(o: SyncOutcome): OutcomeGroup {
  switch (o.kind) {
    case 'conflict':
    case 'autostashConflict':
      return 'conflict'
    case 'authFailed':
    case 'rejected':
    case 'failed':
      return 'failed'
    default:
      return o.kind
  }
}

export function describe(o: SyncOutcome): string {
  switch (o.kind) {
    case 'autostashConflict':
      return 'autostash conflict, stash entry kept'
    case 'authFailed':
      return 'auth failed'
    case 'rejected':
      return 'the remote has commits you do not have: pull first'
    case 'skipped':
      return o.reason
    case 'failed':
      return o.message
    default:
      return GROUP_LABEL[groupOf(o)]
  }
}

export function groupResults(results: RepoResult[]): [OutcomeGroup, RepoResult[]][] {
  const order = Object.keys(GROUP_LABEL) as OutcomeGroup[]
  return order
    .map((g): [OutcomeGroup, RepoResult[]] => [g, results.filter((r) => groupOf(r.outcome) === g)])
    .filter(([, rs]) => rs.length > 0)
}
