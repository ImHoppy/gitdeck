import { describe, expect, test } from 'bun:test'
import { githubRef, isAttachment, resolveHref } from './links'

describe('resolveHref', () => {
  const links = { repo: 'a/b', head: 'feat' }

  test('safe schemes pass, others are dropped', () => {
    expect(resolveHref('https://x.io', links)).toBe('https://x.io')
    expect(resolveHref('mailto:me@x.io', links)).toBe('mailto:me@x.io')
    expect(resolveHref('javascript:alert(1)', links)).toBeNull()
    expect(resolveHref(' JavaScript:alert(1)', links)).toBeNull()
    expect(resolveHref('data:text/html,x', links)).toBeNull()
    expect(resolveHref('//evil.io/x', links)).toBeNull()
  })

  test('relative links go to the repo at the PR head', () => {
    expect(resolveHref('docs/x.md', links)).toBe('https://github.com/a/b/blob/feat/docs/x.md')
    expect(resolveHref('/img/s.png', links, true)).toBe('https://github.com/a/b/raw/feat/img/s.png')
    expect(resolveHref('./shot.png', links, true)).toBe('./shot.png')
    expect(resolveHref('#fn-1', links)).toBe('#fn-1')
    expect(resolveHref('x.md', { repo: null })).toBeNull()
  })
})

test('github PR links and attachments', () => {
  expect(githubRef('https://github.com/AvaCreation/ui/pull/45')).toEqual({ repo: 'AvaCreation/ui', number: 45 })
  expect(githubRef('https://github.com/a/b/issues/3#x')).toEqual({ repo: 'a/b', number: 3 })
  expect(githubRef('https://github.com/a/b')).toBeNull()
  expect(isAttachment('https://github.com/user-attachments/assets/1f2e-aa')).toBe(true)
  expect(isAttachment('https://github.com/user-attachments/assets/1f2e-aa.png')).toBe(false)
})
