import type { PrSummary } from '../../protocol/github'

export type Scope = 'mine' | 'review' | 'all'

/** A PR row with the repo it belongs to, so "All repos" can merge every list. */
export type PrRow = PrSummary & { repo: string; repoId: number | null }

/** "Mine" and "Review requested" are GitHub searches already: only the text filter runs here. */
export function filterPrs(rows: PrRow[], text: string): PrRow[] {
  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return rows.filter((pr) => {
    if (words.length === 0) return true
    const hay = `#${pr.number} ${pr.title} ${pr.author} ${pr.headRefName} ${pr.repo}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}

/** Newest activity first, like a mailbox. */
export const byUpdated = (a: PrRow, b: PrRow) => b.updatedAt.localeCompare(a.updatedAt)

export const rowKey = (pr: PrRow) => `${pr.repo}#${pr.number}`
