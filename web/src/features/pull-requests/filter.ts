import type { PrOrder, PrQuery, PrSort, PrSummary } from '../../protocol/github'

export type Scope = PrQuery['scope']

/** A PR row with the repo it belongs to, so "All repos" can merge every list. */
export type PrRow = PrSummary & { repo: string; repoId: number | null }

/** "Mine", "Review requested" and labels are GitHub searches already: only the text filter runs here. */
export function filterPrs(rows: PrRow[], text: string): PrRow[] {
  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return rows.filter((pr) => {
    if (words.length === 0) return true
    const hay = `#${pr.number} ${pr.title} ${pr.author} ${pr.headRefName} ${pr.repo} ${pr.labels.map((l) => l.name).join(' ')}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}

/** Newest activity first, like a mailbox. */
export const byUpdated = (a: PrRow, b: PrRow) => b.updatedAt.localeCompare(a.updatedAt)

/**
 * GitHub's own order, to merge the lists of several repos; "best match" ranks within one repo
 * only, so those lists stay one after the other.
 */
export function bySort(sort: PrSort, order: PrOrder): (a: PrRow, b: PrRow) => number {
  const sign = order === 'asc' ? -1 : 1
  switch (sort) {
    case 'created':
      return (a, b) => sign * b.createdAt.localeCompare(a.createdAt)
    case 'updated':
      return (a, b) => sign * byUpdated(a, b)
    case 'comments':
      return (a, b) => sign * (b.comments - a.comments)
    case 'bestMatch':
      return () => 0
  }
}

/** One string per list, the same for the query sent and the list gitd pushes back. */
export const queryKey = (q: PrQuery) => [q.state, q.scope, q.sort, q.order, q.noLabel ? '-' : q.labels.join('\u0000')].join(':')

export const rowKey = (pr: PrRow) => `${pr.repo}#${pr.number}`

/** The list the mode button counts unread PRs in: GitHub's default view. */
export const OPEN_PRS: PrQuery = { state: 'open', scope: 'all', labels: [], noLabel: false, sort: 'updated', order: 'desc' }
