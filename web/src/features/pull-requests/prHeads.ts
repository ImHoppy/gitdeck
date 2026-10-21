import type { PrSummary } from '../../protocol/github'
import type { GitRef } from '../../protocol/types'

export type PrHeadMark = { number: number; title: string; isDraft: boolean }

/** Commits that are a PR's head, for the pills in the revision grid: by SHA, or by branch name. */
export function prsBySha(prs: PrSummary[], refs: GitRef[], remote: string): Map<string, PrHeadMark[]> {
  const out = new Map<string, PrHeadMark[]>()
  const add = (sha: string, pr: PrSummary) => {
    const list = out.get(sha) ?? []
    if (!list.some((p) => p.number === pr.number)) out.set(sha, [...list, { number: pr.number, title: pr.title, isDraft: pr.isDraft }])
  }
  for (const pr of prs) {
    if (pr.state !== 'OPEN') continue
    if (pr.headRefOid) add(pr.headRefOid, pr)
    if (pr.isCrossRepository) continue
    for (const r of refs) {
      const named = (r.kind === 'branch' && r.name === pr.headRefName) || (r.kind === 'remote' && r.name === `${remote}/${pr.headRefName}`)
      if (named) add(r.sha, pr)
    }
  }
  return out
}
