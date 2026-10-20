import type { GitRef, RepoAction, ResetMode, Stash, SyncOutcome } from '../../protocol/types'
import type { Browse } from '../../ui/Dialog/useDialogs'
import type { MenuItem } from '../../ui/Menu/Menu'

export type Commands = {
  run: (title: string, action: RepoAction) => Promise<SyncOutcome>
  /** `true`: OK with an empty field answers "" rather than being disabled; a function: a Browse… picker. */
  prompt: (title: string, label: string, value?: string, browseOrEmpty?: Browse | boolean) => Promise<string | null>
  confirm: (title: string, body: string, ok?: string) => Promise<boolean>
}

type Ctx = { cmd: Commands; currentBranch: string | null; remotes: string[] }

const item = (key: string, label: string, onSelect: () => void, extra: Partial<Exclude<MenuItem, 'separator'>> = {}): MenuItem => ({
  key,
  label,
  onSelect,
  ...extra,
})

async function createBranch({ cmd }: Ctx, at: string, suggested = '') {
  const name = await cmd.prompt('Create branch', `New branch at ${at.slice(0, 10)}`, suggested)
  if (name) await cmd.run(`create ${name}`, { kind: 'createBranch', name, at, checkout: true })
}

async function createTag({ cmd }: Ctx, at: string) {
  const name = await cmd.prompt('Create tag', `New tag at ${at.slice(0, 10)}`)
  if (!name) return
  // a message makes it an annotated tag (author, date, text); empty keeps it lightweight
  const message = await cmd.prompt('Tag message', 'Message for an annotated tag (leave empty for a plain tag)', '', true)
  if (message === null) return
  await cmd.run(`tag ${name}`, { kind: 'createTag', name, at, message: message || null })
}

async function reset({ cmd, currentBranch }: Ctx, sha: string, mode: ResetMode) {
  if (mode === 'hard') {
    const ok = await cmd.confirm('Hard reset?', `${currentBranch ?? 'HEAD'} moves to ${sha.slice(0, 10)} and all uncommitted changes are lost.`, 'Reset')
    if (!ok) return
  }
  await cmd.run(`reset --${mode}`, { kind: 'reset', sha, mode })
}

function onto(ctx: Ctx, rev: string, label: string): MenuItem[] {
  const cur = ctx.currentBranch ?? 'HEAD'
  return [
    item('merge', `Merge ${label} into ${cur}`, () => void ctx.cmd.run(`merge ${label}`, { kind: 'merge', rev, mode: 'default' }), { icon: 'merge' }),
    item('merge-noff', `Merge ${label} into ${cur} (always a merge commit)`, () => void ctx.cmd.run(`merge --no-ff ${label}`, { kind: 'merge', rev, mode: 'noFastForward' })),
    item('merge-squash', `Squash ${label} into ${cur} (staged, commit it yourself)`, () => void ctx.cmd.run(`merge --squash ${label}`, { kind: 'merge', rev, mode: 'squash' })),
    item('rebase', `Rebase ${cur} onto ${label}`, () => void ctx.cmd.run(`rebase onto ${label}`, { kind: 'rebase', onto: rev }), { icon: 'branch' }),
  ]
}

export function commitMenu(ctx: Ctx, sha: string, branchesHere: string[]): MenuItem[] {
  return [
    ...branchesHere.map((b) => item(`co-${b}`, `Checkout branch ${b}`, () => void ctx.cmd.run(`checkout ${b}`, { kind: 'checkout', branch: b }), { icon: 'checkout' })),
    item('detach', 'Checkout this commit (detached)', () => void ctx.cmd.run('checkout', { kind: 'checkoutDetached', sha }), { icon: 'checkout' }),
    item('branch', 'Create branch here…', () => void createBranch(ctx, sha), { icon: 'branch' }),
    item('tag', 'Create tag here…', () => void createTag(ctx, sha), { icon: 'tag' }),
    'separator',
    ...onto(ctx, sha, sha.slice(0, 7)),
    item('pick', 'Cherry-pick this commit', () => void ctx.cmd.run('cherry-pick', { kind: 'cherryPick', sha })),
    item('revert', 'Revert this commit', () => void ctx.cmd.run('revert', { kind: 'revert', sha })),
    'separator',
    item('soft', 'Reset current branch here (soft)', () => void reset(ctx, sha, 'soft')),
    item('mixed', 'Reset current branch here (mixed)', () => void reset(ctx, sha, 'mixed')),
    item('hard', 'Reset current branch here (hard)…', () => void reset(ctx, sha, 'hard'), { danger: true }),
    'separator',
    item('copy', 'Copy commit hash', () => void navigator.clipboard?.writeText(sha), { icon: 'copy' }),
  ]
}

/** The toolbar's branch switcher: local branches, then remote ones with no local branch yet. */
export function branchMenu(ctx: Ctx, refs: GitRef[], head: string | null): MenuItem[] {
  const { cmd, currentBranch } = ctx
  const local = refs.filter((r) => r.kind === 'branch').sort((a, b) => a.name.localeCompare(b.name))
  const names = new Set(local.map((r) => r.name))
  const remoteOnly = refs
    .filter((r) => r.kind === 'remote' && !r.name.endsWith('/HEAD'))
    .map((r) => ({ ref: r, name: r.name.slice(r.name.indexOf('/') + 1) }))
    .filter((r) => !names.has(r.name))
    .sort((a, b) => a.ref.name.localeCompare(b.ref.name))
  return [
    ...local.map((r) =>
      item(`co-${r.name}`, r.name, () => void cmd.run(`checkout ${r.name}`, { kind: 'checkout', branch: r.name }), {
        checked: r.name === currentBranch,
        icon: 'branch',
        disabled: r.name === currentBranch,
      }),
    ),
    ...(remoteOnly.length ? ['separator' as const] : []),
    ...remoteOnly.map(({ ref, name }) =>
      item(`rco-${ref.name}`, `${ref.name} → new local ${name}`, () => void cmd.run(`checkout ${name}`, { kind: 'checkoutRemote', remoteBranch: ref.name, local: name }), {
        icon: 'fetch',
      }),
    ),
    'separator',
    item('new', 'Create branch here…', () => void createBranch(ctx, head ?? 'HEAD'), { icon: 'add' }),
  ]
}

/** The toolbar's Push menu: plain push, publishing a new branch, force push, tags. */
export function pushMenu(ctx: Ctx, opts: { hasUpstream: boolean; ahead: number; push: () => void }): MenuItem[] {
  const { cmd, currentBranch: branch, remotes } = ctx
  const items: MenuItem[] = [item('push', opts.ahead ? `Push ${opts.ahead} commit${opts.ahead === 1 ? '' : 's'}` : 'Push', opts.push, { icon: 'push', disabled: !opts.hasUpstream || !branch })]
  if (branch && !opts.hasUpstream) {
    items.push(
      ...remotes.map((remote) =>
        item(`pub-${remote}`, `Publish ${branch} to ${remote}`, () => void cmd.run(`publish ${branch}`, { kind: 'publish', remote, branch }), { icon: 'push' }),
      ),
    )
  }
  items.push(
    item('force', 'Force push (with lease)…', async () => {
      const ok = await cmd.confirm(
        'Force push?',
        `${branch ?? 'HEAD'} on the remote is replaced by yours. Refused if someone pushed since your last fetch.`,
        'Force push',
      )
      if (ok) await cmd.run('force push', { kind: 'forcePush' })
    }, { danger: true, disabled: !opts.hasUpstream || !branch }),
    'separator',
    ...remotes.map((remote) => item(`tags-${remote}`, `Push all tags to ${remote}`, () => void cmd.run('push tags', { kind: 'pushTags', remote }), { icon: 'tag' })),
  )
  return items
}

export function refMenu(ctx: Ctx, ref: GitRef): MenuItem[] {
  const { cmd } = ctx
  if (ref.kind === 'branch') {
    const isHead = ref.name === ctx.currentBranch
    return [
      item('co', `Checkout ${ref.name}`, () => void cmd.run(`checkout ${ref.name}`, { kind: 'checkout', branch: ref.name }), { disabled: isHead }),
      ...(isHead ? [] : onto(ctx, ref.name, ref.name)),
      item('branch', 'Create branch from here…', () => void createBranch(ctx, ref.name)),
      'separator',
      item('rename', 'Rename…', async () => {
        const to = await cmd.prompt('Rename branch', `New name for ${ref.name}`, ref.name)
        if (to && to !== ref.name) await cmd.run(`rename ${ref.name}`, { kind: 'renameBranch', from: ref.name, to })
      }),
      item('delete', 'Delete…', () => void deleteBranch(ctx, ref.name), { danger: true, disabled: isHead }),
    ]
  }
  if (ref.kind === 'remote') {
    const slash = ref.name.indexOf('/')
    const [remote, name] = [ref.name.slice(0, slash), ref.name.slice(slash + 1)]
    return [
      item('co', `Checkout as local ${name}…`, async () => {
        const local = await cmd.prompt('Checkout remote branch', 'Local branch name', name)
        if (local) await cmd.run(`checkout ${local}`, { kind: 'checkoutRemote', remoteBranch: ref.name, local })
      }),
      ...onto(ctx, ref.name, ref.name),
      item('branch', 'Create branch from here…', () => void createBranch(ctx, ref.name, name)),
      'separator',
      item('delete', `Delete ${name} on ${remote}…`, async () => {
        if (await cmd.confirm('Delete remote branch?', `${name} will be deleted on ${remote} for everyone.`, 'Delete')) {
          await cmd.run(`delete ${ref.name}`, { kind: 'deleteRemoteBranch', remote, name })
        }
      }, { danger: true }),
    ]
  }
  return [
    ...onto(ctx, ref.name, ref.name),
    item('branch', 'Create branch from here…', () => void createBranch(ctx, ref.name)),
    'separator',
    ...ctx.remotes.map((remote) => item(`push-${remote}`, `Push tag to ${remote}`, () => void cmd.run(`push tag ${ref.name}`, { kind: 'pushTag', remote, name: ref.name }), { icon: 'push' })),
    ...ctx.remotes.map((remote) =>
      item(`rdel-${remote}`, `Delete tag on ${remote}…`, async () => {
        if (await cmd.confirm('Delete remote tag?', `Tag ${ref.name} will be deleted on ${remote} for everyone.`, 'Delete')) {
          await cmd.run(`delete tag ${ref.name} on ${remote}`, { kind: 'deleteRemoteTag', remote, name: ref.name })
        }
      }, { danger: true }),
    ),
    item('delete', 'Delete tag…', async () => {
      if (await cmd.confirm('Delete tag?', `Tag ${ref.name} will be deleted locally.`, 'Delete')) {
        await cmd.run(`delete tag ${ref.name}`, { kind: 'deleteTag', name: ref.name })
      }
    }, { danger: true }),
  ]
}

async function deleteBranch({ cmd }: Ctx, name: string) {
  if (!(await cmd.confirm('Delete branch?', `Branch ${name} will be deleted.`, 'Delete'))) return
  const out = await cmd.run(`delete ${name}`, { kind: 'deleteBranch', name, force: false })
  if (out.kind === 'failed' && out.message.includes('not fully merged')) {
    if (await cmd.confirm('Branch not merged', `${name} has commits that are not merged anywhere. Delete it anyway?`, 'Force delete')) {
      await cmd.run(`delete ${name}`, { kind: 'deleteBranch', name, force: true })
    }
  }
}

export function stashMenu({ cmd }: Ctx, s: Stash): MenuItem[] {
  return [
    item('apply', 'Apply', () => void cmd.run('stash apply', { kind: 'stashApply', index: s.index })),
    item('pop', 'Pop', () => void cmd.run('stash pop', { kind: 'stashPop', index: s.index })),
    'separator',
    item('drop', 'Drop…', async () => {
      if (await cmd.confirm('Drop stash?', `stash@{${s.index}}: ${s.message} will be lost.`, 'Drop')) {
        await cmd.run('stash drop', { kind: 'stashDrop', index: s.index })
      }
    }, { danger: true }),
  ]
}

export async function stashPush({ cmd }: Ctx) {
  const message = await cmd.prompt('Stash changes', 'Message (optional, untracked files included)', 'wip')
  if (message !== null) await cmd.run('stash', { kind: 'stashPush', message, untracked: true })
}
