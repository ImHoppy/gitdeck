import { expect, test } from 'bun:test'
import { refTree } from './refTree'

test('groups branch names into folders, folders first', () => {
  const ref = (name: string) => ({ sha: 'a', kind: 'branch' as const, name, upstream: null })
  const tree = refTree([ref('main'), ref('feat/a'), ref('feat/deep/b'), ref('fix/c')])
  expect(tree.map((n) => n.name)).toEqual(['feat', 'fix', 'main'])
  const feat = tree[0]
  expect(feat.kind === 'folder' && feat.children.map((n) => n.name)).toEqual(['deep', 'a'])
})
