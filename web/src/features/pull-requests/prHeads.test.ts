import { expect, test } from 'bun:test'
import type { PrSummary } from '../../protocol/github'
import { prsBySha } from './prHeads'

const pr = (number: number, head: string, oid: string, extra: Partial<PrSummary> = {}): PrSummary => ({
  number,
  title: `t${number}`,
  author: 'a',
  headRefName: head,
  baseRefName: 'main',
  headRefOid: oid,
  isDraft: false,
  state: 'OPEN',
  reviewDecision: null,
  checks: { passed: 0, failed: 0, pending: 0 },
  createdAt: '',
  updatedAt: '',
  isCrossRepository: false,
  headOwner: null,
  url: '',
  reviewRequests: [],
  labels: [],
  comments: 0,
  ...extra,
})

test('pills by head sha and by branch name', () => {
  const refs = [
    { sha: 'local', kind: 'branch' as const, name: 'feat', upstream: 'origin/feat' },
    { sha: 'remote', kind: 'remote' as const, name: 'origin/feat', upstream: null },
  ]
  const m = prsBySha([pr(1, 'feat', 'remote'), pr(2, 'fork', 'x', { isCrossRepository: true }), pr(3, 'old', 'y', { state: 'MERGED' })], refs, 'origin')
  expect(m.get('remote')?.map((p) => p.number)).toEqual([1])
  expect(m.get('local')?.map((p) => p.number)).toEqual([1])
  expect(m.get('x')?.map((p) => p.number)).toEqual([2])
  expect(m.has('y')).toBe(false)
})
