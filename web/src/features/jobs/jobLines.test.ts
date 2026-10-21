import { describe, expect, test } from 'bun:test'
import type { JobUpdate } from '../../protocol/types'
import { firstError, mergeJob, progressOf, statusLine } from './jobLines'

const job = (p: Partial<JobUpdate>): JobUpdate => ({
  id: 1,
  repoId: 1,
  title: 'Fetch a',
  background: false,
  from: 0,
  lines: [],
  current: '',
  done: null,
  ...p,
})

describe('jobLines', () => {
  test('merges lines from the update index on', () => {
    const merged = mergeJob(job({ lines: ['a', 'b'] }), job({ from: 1, lines: ['b2', 'c'] }))
    expect(merged.lines).toEqual(['a', 'b2', 'c'])
  })

  test('reads progress and the status line', () => {
    const j = job({ lines: ['$ git fetch'], current: 'Receiving objects:  43% (43/100), 1.20 GiB | 12.00 MiB/s' })
    expect(progressOf(j)).toBe(43)
    expect(statusLine(j)).toStartWith('Receiving objects')
    expect(statusLine(job({ lines: ['done.'] }))).toBe('done.')
  })

  test('finds the error line', () => {
    expect(firstError(job({ lines: ['remote: Counting', 'fatal: unable to access'] }))).toBe('fatal: unable to access')
  })
})
