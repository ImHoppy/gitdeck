import type { GitRef } from '../../protocol/types'

export type Pill =
  | { kind: 'branch'; name: string; head: boolean; remote: string | null; gone: boolean }
  | { kind: 'remote'; name: string }
  | { kind: 'tag'; name: string }

export function pillsBySha(refs: GitRef[], headBranch: string | null): Map<string, Pill[]> {
  const remotes = new Map(refs.filter((r) => r.kind === 'remote').map((r) => [r.name, r]))
  const joined = new Set<string>()
  const out = new Map<string, Pill[]>()
  const add = (sha: string, pill: Pill) => out.set(sha, [...(out.get(sha) ?? []), pill])

  for (const r of refs) {
    if (r.kind !== 'branch') continue
    const up = r.upstream ? remotes.get(r.upstream) : undefined
    const nestled = up && up.sha === r.sha
    if (nestled) joined.add(up.name)
    add(r.sha, {
      kind: 'branch',
      name: r.name,
      head: r.name === headBranch,
      remote: nestled ? up.name.split('/')[0] : null,
      gone: !!r.upstream && !up,
    })
  }
  for (const r of refs) {
    if (r.kind === 'remote' && !joined.has(r.name)) add(r.sha, { kind: 'remote', name: r.name })
    if (r.kind === 'tag') add(r.sha, { kind: 'tag', name: r.name })
  }
  for (const pills of out.values()) pills.sort((a, b) => rank(a) - rank(b))
  return out
}

function rank(p: Pill): number {
  if (p.kind === 'branch') return p.head ? 0 : 1
  return p.kind === 'remote' ? 2 : 3
}
