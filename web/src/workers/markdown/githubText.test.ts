import { describe, expect, test } from 'bun:test'
import { linkText, shortenUrl } from './githubText'

const kinds = (s: string) => linkText(s).map((n) => (n.type === 'text' ? n.value : n.type === 'ghRef' ? `ref:${n.repo ?? ''}#${n.number}` : n.type === 'ghCommit' ? `sha:${n.repo ?? ''}@${n.sha}` : n.type === 'mention' ? `@${n.login}` : n.type))

describe('linkText', () => {
  test('pull request references', () => {
    expect(kinds('fixes #12 and AvaCreation/ui#45.')).toEqual(['fixes ', 'ref:#12', ' and ', 'ref:AvaCreation/ui#45', '.'])
    expect(kinds('see GH-7')).toEqual(['see ', 'ref:#7'])
    expect(kinds('(#3)')).toEqual(['(', 'ref:#3', ')'])
  })

  test('words that only look like references stay text', () => {
    expect(kinds('a#1 x@y.com C#')).toEqual(['a#1 x@y.com C#'])
    expect(kinds('deadbeef 1234567 and 2026-10-22')).toEqual(['deadbeef 1234567 and 2026-10-22'])
  })

  test('commits and mentions', () => {
    expect(kinds('in a1b2c3d by @hoppy')).toEqual(['in ', 'sha:@a1b2c3d', ' by ', '@hoppy'])
    expect(kinds('cli/cli@0123abc4')).toEqual(['sha:cli/cli@0123abc4'])
    expect(kinds('@-bad and @ok-name')).toEqual(['@-bad and ', '@ok-name'])
  })

  test('emoji shortcodes', () => {
    expect(kinds(':tada: done :not_an_emoji_name:')).toEqual(['🎉 done :not_an_emoji_name:'])
  })
})

describe('shortenUrl', () => {
  test('PR, issue and commit URLs', () => {
    expect(shortenUrl('https://github.com/a/b/pull/12')).toEqual({ type: 'ghRef', repo: 'a/b', number: 12, text: 'a/b#12' })
    expect(shortenUrl('https://github.com/a/b/issues/3#issuecomment-1')).toMatchObject({ number: 3 })
    expect(shortenUrl('https://github.com/a/b/commit/0123456789abcdef')).toMatchObject({ type: 'ghCommit', text: 'a/b@0123456' })
    expect(shortenUrl('https://github.com/a/b/blob/main/x.md')).toBeNull()
  })
})
