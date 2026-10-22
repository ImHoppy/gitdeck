import { useEffect, useState } from 'react'
import { gitd } from '../../protocol/client'
import type { GithubRepoLink, RepoLabel } from '../../protocol/github'

const asked = new Map<string, Promise<RepoLabel[]>>()

function labelsOf(r: GithubRepoLink): Promise<RepoLabel[]> {
  const k = r.repo.toLowerCase()
  let p = asked.get(k)
  if (!p) {
    p = gitd.call<RepoLabel[]>('pr.labels', { id: r.id }).catch(() => {
      asked.delete(k)
      return []
    })
    asked.set(k, p)
  }
  return p
}

/** The labels of `repos`, merged by name for "All repos", asked once the picker opens. */
export function useRepoLabels(repos: GithubRepoLink[], wanted: boolean): RepoLabel[] | null {
  const [labels, setLabels] = useState<{ of: string; list: RepoLabel[] } | null>(null)
  const key = repos.map((r) => r.repo.toLowerCase()).join(',')

  useEffect(() => {
    if (!wanted || labels?.of === key) return
    let live = true
    void Promise.all(repos.map(labelsOf)).then((all) => {
      if (!live) return
      const byName = new Map<string, RepoLabel>()
      for (const l of all.flat()) if (!byName.has(l.name.toLowerCase())) byName.set(l.name.toLowerCase(), l)
      setLabels({ of: key, list: [...byName.values()].sort((a, b) => a.name.localeCompare(b.name)) })
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, wanted])

  return labels?.of === key ? labels.list : null
}
