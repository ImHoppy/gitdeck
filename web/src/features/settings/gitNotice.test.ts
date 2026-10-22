import { expect, test } from 'bun:test'
import { gitNotice } from './gitNotice'
import type { ServerInfo } from './useServerInfo'

const info = (gitSupport: ServerInfo['gitSupport'], gitVersion: string | null = 'git version 2.45.0') =>
  ({ gitSupport, gitVersion, gitMinimum: '2.36.0', gitPatched: '2.50.1' }) as ServerInfo

test('says nothing for a supported or missing git', () => {
  expect(gitNotice(null)).toBeNull()
  expect(gitNotice(info('ok'))).toBeNull()
  expect(gitNotice(info(null, null))).toBeNull()
})

test('names the version and what to install', () => {
  expect(gitNotice(info('tooOld', 'git version 2.30.1'))).toEqual({
    tone: 'bad',
    short: 'git too old',
    text: 'git 2.30.1 is too old: gitdeck needs git 2.36.0 or newer.',
  })
  const warn = gitNotice(info('unpatched'))
  expect(warn?.tone).toBe('warn')
  expect(warn?.text).toContain('git 2.45.0 misses a security fix')
  expect(warn?.text).toContain('2.50.1 or newer')
})
