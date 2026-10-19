import { expect, test } from 'bun:test'
import { pillsBySha } from './refPills'

test('joins a branch with its upstream only when both point at the same commit', () => {
  const pills = pillsBySha(
    [
      { sha: 'a', kind: 'branch', name: 'main', upstream: 'origin/main' },
      { sha: 'a', kind: 'remote', name: 'origin/main', upstream: null },
      { sha: 'b', kind: 'branch', name: 'feat', upstream: 'origin/feat' },
      { sha: 'c', kind: 'remote', name: 'origin/feat', upstream: null },
      { sha: 'c', kind: 'tag', name: 'v1', upstream: null },
      { sha: 'd', kind: 'branch', name: 'old', upstream: 'origin/old' },
    ],
    'main',
  )
  expect(pills.get('a')).toEqual([{ kind: 'branch', name: 'main', head: true, remote: 'origin', gone: false }])
  expect(pills.get('b')?.[0]).toMatchObject({ name: 'feat', remote: null })
  expect(pills.get('c')?.map((p) => p.kind)).toEqual(['remote', 'tag'])
  expect(pills.get('d')?.[0]).toMatchObject({ gone: true })
})
