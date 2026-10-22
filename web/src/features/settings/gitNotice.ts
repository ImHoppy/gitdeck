import type { ServerInfo } from './useServerInfo'

export type GitNotice = { tone: 'bad' | 'warn'; short: string; text: string }

/** What to tell the user about the git gitd runs, or null when it is fine (or not found). */
export function gitNotice(info: ServerInfo | null): GitNotice | null {
  if (!info?.gitSupport || info.gitSupport === 'ok') return null
  const version = info.gitVersion?.replace(/^git version /, '') ?? '?'
  if (info.gitSupport === 'tooOld') {
    return { tone: 'bad', short: 'git too old', text: `git ${version} is too old: gitdeck needs git ${info.gitMinimum} or newer.` }
  }
  return {
    tone: 'warn',
    short: 'update git',
    text: `git ${version} misses a security fix: cloning an untrusted repository with submodules can run its code (CVE-2025-48384). Update to git ${info.gitPatched} or newer.`,
  }
}
