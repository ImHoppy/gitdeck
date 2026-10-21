import type { PrDetail } from '../../protocol/github'

/** Why GitHub won't merge now, from `mergeStateStatus`; null when it will. */
export function mergeBlocked(d: PrDetail): string | null {
  if (d.state !== 'OPEN') return `the PR is ${d.state.toLowerCase()}`
  if (d.isDraft) return 'it is a draft: mark it ready for review first'
  switch (d.mergeStateStatus) {
    case 'BLOCKED':
      return 'blocked: required reviews or checks are missing'
    case 'DIRTY':
      return 'it conflicts with the base: rebase it first'
    case 'BEHIND':
      return 'the branch is behind its base: update it first'
    case 'UNKNOWN':
      return 'GitHub is still checking whether it can merge: refresh in a moment'
    default:
      return null
  }
}

export type SquashMessage = { subject: string; body: string }

/** What GitHub proposes for a squash: the PR title with its number, the commits as a list. */
export function defaultSquash(d: PrDetail): SquashMessage {
  const body = d.commits.length > 1 ? d.commits.map((c) => `* ${c.headline}`).join('\n') : ''
  return { subject: `${d.title} (#${d.number})`, body }
}
