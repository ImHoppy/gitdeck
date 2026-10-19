import { describe, expect, test } from 'bun:test'
import type { RepoSnapshot } from '../../protocol/types'
import { buildTree, filterAttention, rollup } from './model'

function repo(id: number, parent: number | null, pathInParent: string | null, behind = 0): RepoSnapshot {
  return {
    id,
    parent,
    pathInParent,
    path: '',
    name: pathInParent?.split('/').pop() ?? 'root',
    recordedSha: null,
    initialized: true,
    excluded: false,
    pointerDiffers: false,
    error: null,
    state: {
      head: { kind: 'branch', name: 'main' },
      headSha: 'a',
      tracking: { ahead: 0, behind, gone: false },
      status: { staged: 0, unstaged: 0, untracked: 0, conflicts: 0 },
      operation: null,
    },
  }
}

describe('buildTree', () => {
  const repos = [repo(0, null, null), repo(1, 0, 'cfg'), repo(2, 0, 'res/[s]/ui', 3), repo(3, 0, 'res/[s]/ava')]

  test('groups submodules under folder nodes', () => {
    const [root] = buildTree(repos)
    expect(root.children.map((c) => c.kind)).toEqual(['repo', 'folder'])
    const res = root.children[1]
    expect(res.kind === 'folder' && res.name).toBe('res')
    expect(res.children[0].children).toHaveLength(2)
  })

  test('rolls up and filters by attention', () => {
    const [root] = buildTree(repos)
    expect(rollup(root.children).behind).toBe(1)
    const filtered = filterAttention(root.children)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].children[0].children).toHaveLength(1)
  })
})
