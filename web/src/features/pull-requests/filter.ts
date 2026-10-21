import type { PrSummary } from '../../protocol/github'

export type Scope = 'mine' | 'review' | 'all'

/** A PR row with the repo it belongs to, so "All repos" can merge every list. */
export type PrRow = PrSummary & { repo: string; repoId: number | null }

export function filterPrs(rows: PrRow[], scope: Scope, text: string, login: string | null): PrRow[] {
  const me = login?.toLowerCase()
  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return rows.filter((pr) => {
    if (scope === 'mine' && pr.author.toLowerCase() !== me) return false
    if (scope === 'review' && !pr.reviewRequests.some((r) => r.toLowerCase() === me)) return false
    if (words.length === 0) return true
    const hay = `#${pr.number} ${pr.title} ${pr.author} ${pr.headRefName} ${pr.repo}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}

/** Newest activity first, like a mailbox. */
export const byUpdated = (a: PrRow, b: PrRow) => b.updatedAt.localeCompare(a.updatedAt)

export const rowKey = (pr: PrRow) => `${pr.repo}#${pr.number}`
