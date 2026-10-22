import { describe, expect, test } from 'bun:test'
import { bySort, byUpdated, filterPrs, type PrRow, queryKey } from './filter'
import type { PrQuery } from '../../protocol/github'
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
  createdAt: `2026-09-0${n}T00:00:00Z`,
  updatedAt: `2026-10-0${n}T00:00:00Z`,
  isCrossRepository: false,
  headOwner: null,
  url: '',
  reviewRequests: [],
  labels: [],
  comments: 0,
  repo: 'a/b',
  repoId: 1,
  ...extra,
})

describe('filterPrs', () => {
  const rows = [pr(1), pr(2, { author: 'Bob', reviewRequests: ['ALICE'] }), pr(3, { title: 'Fix auto fetch backoff' })]

  test('text matches every word anywhere', () => {
    expect(filterPrs(rows, 'backoff fix').map((p) => p.number)).toEqual([3])
    expect(filterPrs(rows, '#2').map((p) => p.number)).toEqual([2])
    expect(filterPrs(rows, 'feat/1').map((p) => p.number)).toEqual([1])
  })

  test('newest first', () => {
    expect([...rows].sort(byUpdated).map((p) => p.number)).toEqual([3, 2, 1])
  })

  test('labels match the text too', () => {
    const labelled = [...rows, pr(4, { labels: [{ name: 'database', color: '006b75' }] })]
    expect(filterPrs(labelled, 'datab').map((p) => p.number)).toEqual([4])
  })

  test('merges by the sort GitHub used', () => {
    const many = [pr(1, { comments: 5 }), pr(2, { comments: 9, createdAt: '2026-01-01T00:00:00Z' }), pr(3)]
    expect([...many].sort(bySort('comments', 'desc')).map((p) => p.number)).toEqual([2, 1, 3])
    expect([...many].sort(bySort('created', 'asc')).map((p) => p.number)).toEqual([2, 1, 3])
    expect([...many].sort(bySort('updated', 'asc')).map((p) => p.number)).toEqual([1, 2, 3])
    expect([...many].sort(bySort('bestMatch', 'desc')).map((p) => p.number)).toEqual([1, 2, 3])
  })

  test('no label wins over picked labels in the key', () => {
    const q: PrQuery = { state: 'open', scope: 'all', labels: ['bug'], noLabel: false, sort: 'updated', order: 'desc' }
    expect(queryKey(q)).not.toEqual(queryKey({ ...q, labels: [] }))
    expect(queryKey({ ...q, noLabel: true })).toEqual(queryKey({ ...q, labels: [], noLabel: true }))
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
