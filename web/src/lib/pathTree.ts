export type PathNode<T> =
  | { kind: 'dir'; name: string; path: string; children: PathNode<T>[] }
  | { kind: 'leaf'; name: string; path: string; item: T }

/** Folders first, then files, both by name; a chain of single-folder dirs is merged into one ("a/b/c"). */
export function buildPathTree<T>(items: readonly T[], pathOf: (t: T) => string): PathNode<T>[] {
  type Dir = { dirs: Map<string, Dir>; leaves: PathNode<T>[] }
  const root: Dir = { dirs: new Map(), leaves: [] }
  for (const item of items) {
    const parts = pathOf(item).split('/')
    let dir = root
    for (const part of parts.slice(0, -1)) {
      let next = dir.dirs.get(part)
      if (!next) dir.dirs.set(part, (next = { dirs: new Map(), leaves: [] }))
      dir = next
    }
    dir.leaves.push({ kind: 'leaf', name: parts[parts.length - 1], path: pathOf(item), item })
  }

  const toNodes = (dir: Dir, prefix: string): PathNode<T>[] => {
    const dirs = [...dir.dirs.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, d]): PathNode<T> => {
        let label = name
        let path = prefix + name
        while (d.leaves.length === 0 && d.dirs.size === 1) {
          const [[child, next]] = d.dirs
          label += `/${child}`
          path += `/${child}`
          d = next
        }
        return { kind: 'dir', name: label, path, children: toNodes(d, `${path}/`) }
      })
    return [...dirs, ...dir.leaves.sort((a, b) => a.name.localeCompare(b.name))]
  }
  return toNodes(root, '')
}

export type FlatNode<T> = { node: PathNode<T>; depth: number }

export function flattenPathTree<T>(nodes: PathNode<T>[], collapsed: ReadonlySet<string>, depth = 0, out: FlatNode<T>[] = []) {
  for (const node of nodes) {
    out.push({ node, depth })
    if (node.kind === 'dir' && !collapsed.has(node.path)) flattenPathTree(node.children, collapsed, depth + 1, out)
  }
  return out
}
