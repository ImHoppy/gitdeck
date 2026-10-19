import { expect, test } from 'bun:test'
import { relativeTime } from './relativeTime'

test('formats past times in the largest unit', () => {
  const now = 1_700_000_000_000
  const at = (secsAgo: number) => relativeTime(now / 1000 - secsAgo, now)
  expect(at(10)).toBe('just now')
  expect(at(13 * 60)).toBe('13 minutes ago')
  expect(at(3 * 24 * 3600)).toBe('3 days ago')
  expect(at(400 * 24 * 3600)).toBe('last year')
})
