import { describe, expect, test } from 'bun:test'
import { byUpdated, filterPrs, type PrRow } from './filter'
import { isUnread } from './unread'

const pr = (n: number, extra: Partial<PrRow> = {}): PrRow => ({
  number: n,
  title: `PR ${n}`,
  author: 'alice',
  headRefName: `feat/${n}`,
  baseRefName: 'main',
  headRefOid: 'a'.repeat(40),
  isDraft: false,
  state: 'OPEN',
  reviewDecision: null,
  checks: { passed: 0, failed: 0, pending: 0 },
  updatedAt: `2026-10-0${n}T00:00:00Z`,
  isCrossRepository: false,
  headOwner: null,
  url: '',
  reviewRequests: [],
  repo: 'a/b',
  repoId: 1,
  ...extra,
})

describe('filterPrs', () => {
  const rows = [pr(1), pr(2, { author: 'Bob', reviewRequests: ['ALICE'] }), pr(3, { title: 'Fix auto fetch backoff' })]

  test('scopes', () => {
    expect(filterPrs(rows, 'mine', '', 'Alice').map((p) => p.number)).toEqual([1, 3])
    expect(filterPrs(rows, 'review', '', 'alice').map((p) => p.number)).toEqual([2])
    expect(filterPrs(rows, 'all', '', null)).toHaveLength(3)
  })

  test('text matches every word anywhere', () => {
    expect(filterPrs(rows, 'all', 'backoff fix', null).map((p) => p.number)).toEqual([3])
    expect(filterPrs(rows, 'all', '#2', null).map((p) => p.number)).toEqual([2])
    expect(filterPrs(rows, 'all', 'feat/1', null).map((p) => p.number)).toEqual([1])
  })

  test('newest first', () => {
    expect([...rows].sort(byUpdated).map((p) => p.number)).toEqual([3, 2, 1])
  })
})

describe('isUnread', () => {
  const seen = { prs: { 'a/b#1': '2026-10-05T00:00:00Z' }, since: { 'a/b': '2026-10-03T00:00:00Z' } }

  test('newer than the last look, or than the baseline for never-opened PRs', () => {
    expect(isUnread(seen, 'A/B', 1, '2026-10-06T00:00:00Z')).toBe(true)
    expect(isUnread(seen, 'a/b', 1, '2026-10-05T00:00:00Z')).toBe(false)
    expect(isUnread(seen, 'a/b', 2, '2026-10-02T00:00:00Z')).toBe(false)
    expect(isUnread(seen, 'a/b', 2, '2026-10-04T00:00:00Z')).toBe(true)
    expect(isUnread(seen, 'c/d', 2, '2026-10-04T00:00:00Z')).toBe(false)
  })
})
