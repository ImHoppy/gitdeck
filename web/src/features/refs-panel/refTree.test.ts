import { expect, test } from 'bun:test'
import { refTree } from './refTree'

test('groups branch names into folders, default branch first, then folders', () => {
  const ref = (name: string) => ({ sha: 'a', kind: 'branch' as const, name, upstream: null })
  const tree = refTree([ref('main'), ref('feat/a'), ref('feat/deep/b'), ref('fix/c')], (r) => r.name === 'main')
  expect(tree.map((n) => n.name)).toEqual(['main', 'feat', 'fix'])
  const feat = tree[1]
  expect(feat.kind === 'folder' && feat.children.map((n) => n.name)).toEqual(['deep', 'a'])
})
