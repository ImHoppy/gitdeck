import { expect, test } from 'bun:test'
import { describe as describeOutcome, groupResults } from './outcome'

test('groups results with conflicts and failures first', () => {
  const groups = groupResults([
    { id: 1, outcome: { kind: 'upToDate' }, submodulesMoved: [] },
    { id: 2, outcome: { kind: 'autostashConflict' }, submodulesMoved: [] },
    { id: 3, outcome: { kind: 'authFailed' }, submodulesMoved: [] },
    { id: 4, outcome: { kind: 'done' }, submodulesMoved: [] },
  ])
  expect(groups.map(([g, rs]) => [g, rs.map((r) => r.id)])).toEqual([
    ['conflict', [2]],
    ['failed', [3]],
    ['done', [4]],
    ['upToDate', [1]],
  ])
})

test('describes skipped and failed with their reason', () => {
  expect(describeOutcome({ kind: 'skipped', reason: 'detached HEAD' })).toBe('detached HEAD')
  expect(describeOutcome({ kind: 'failed', message: 'fatal: x' })).toBe('fatal: x')
})
