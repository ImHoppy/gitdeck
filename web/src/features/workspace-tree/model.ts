import type { RepoSnapshot } from '../../protocol/types'

export type RepoNode = { kind: 'repo'; key: string; repo: RepoSnapshot; children: TreeNode[] }
export type FolderNode = { kind: 'folder'; key: string; name: string; children: TreeNode[] }
export type TreeNode = RepoNode | FolderNode

export function buildTree(repos: RepoSnapshot[]): RepoNode[] {
  const nodes = new Map(repos.map((r) => [r.id, repoNode(r)]))
  const roots: RepoNode[] = []
  for (const repo of repos) {
    const node = nodes.get(repo.id)!
    if (repo.parent === null) {
      roots.push(node)
      continue
    }
    const parent = nodes.get(repo.parent)!
    const segments = (repo.pathInParent ?? repo.name).split('/')
    segments.pop()
    folderFor(parent, segments).push(node)
  }
  return roots
}

function repoNode(repo: RepoSnapshot): RepoNode {
  return { kind: 'repo', key: `r${repo.id}`, repo, children: [] }
}

function folderFor(parent: RepoNode, segments: string[]): TreeNode[] {
  let children = parent.children
  let key = parent.key
  for (const name of segments) {
    key += `/${name}`
    let folder = children.find((c): c is FolderNode => c.kind === 'folder' && c.name === name)
    if (!folder) {
      folder = { kind: 'folder', key, name, children: [] }
      children.push(folder)
    }
    children = folder.children
  }
  return children
}

export function needsAttention(repo: RepoSnapshot): boolean {
  const s = repo.state
  if (repo.error) return true
  if (!s) return false
  return (
    s.status.unstaged + s.status.untracked + s.status.conflicts + s.status.staged > 0 ||
    (s.tracking.ahead ?? 0) > 0 ||
    (s.tracking.behind ?? 0) > 0 ||
    s.tracking.gone ||
    s.head.kind === 'detached' ||
    s.operation !== null ||
    repo.lastFetch?.outcome.kind === 'failed' ||
    repo.lastFetch?.outcome.kind === 'authFailed'
  )
}

export type Rollup = { behind: number; ahead: number; dirty: number }

export function rollup(nodes: TreeNode[]): Rollup {
  const total: Rollup = { behind: 0, ahead: 0, dirty: 0 }
  for (const node of nodes) {
    if (node.kind === 'repo' && node.repo.state) {
      const s = node.repo.state
      if ((s.tracking.behind ?? 0) > 0) total.behind++
      if ((s.tracking.ahead ?? 0) > 0) total.ahead++
      if (s.status.unstaged + s.status.untracked + s.status.conflicts > 0) total.dirty++
    }
    const sub = rollup(node.children)
    total.behind += sub.behind
    total.ahead += sub.ahead
    total.dirty += sub.dirty
  }
  return total
}

export function filterAttention(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((node) => {
    const children = filterAttention(node.children)
    const keep = children.length > 0 || (node.kind === 'repo' && needsAttention(node.repo))
    return keep ? [{ ...node, children }] : []
  })
}
