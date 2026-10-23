import type { GitRef } from '../../protocol/types'

export type RefNode = { kind: 'folder'; name: string; path: string; children: RefNode[] } | { kind: 'ref'; name: string; ref: GitRef }

/** Splits names on `/` into folders, like upstream's `BranchPathNode`; the `top` ref first, then folders. */
export function refTree(refs: GitRef[], top: (ref: GitRef) => boolean = () => false): RefNode[] {
  const root: RefNode[] = []
  for (const ref of refs) {
    const parts = ref.name.split('/')
    let level = root
    let path = ''
    for (const part of parts.slice(0, -1)) {
      path += `${part}/`
      let folder = level.find((n): n is Extract<RefNode, { kind: 'folder' }> => n.kind === 'folder' && n.name === part)
      if (!folder) {
        folder = { kind: 'folder', name: part, path, children: [] }
        level.push(folder)
      }
      level = folder.children
    }
    level.push({ kind: 'ref', name: parts[parts.length - 1], ref })
  }
  sort(root, top)
  return root
}

function sort(nodes: RefNode[], top: (ref: GitRef) => boolean) {
  const first = (n: RefNode) => Number(n.kind === 'ref' && top(n.ref))
  nodes.sort((a, b) => first(b) - first(a) || (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'folder' ? -1 : 1))
  for (const n of nodes) if (n.kind === 'folder') sort(n.children, top)
}
