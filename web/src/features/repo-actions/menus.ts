import type { GitRef, RepoAction, ResetMode, Stash, SyncOutcome } from '../../protocol/types'
import type { MenuItem } from '../../ui/Menu/Menu'

export type Commands = {
  run: (title: string, action: RepoAction) => Promise<SyncOutcome>
  prompt: (title: string, label: string, value?: string) => Promise<string | null>
  confirm: (title: string, body: string, ok?: string) => Promise<boolean>
}

type Ctx = { cmd: Commands; currentBranch: string | null }

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
  if (name) await cmd.run(`tag ${name}`, { kind: 'createTag', name, at })
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
    item('merge', `Merge ${label} into ${cur}`, () => void ctx.cmd.run(`merge ${label}`, { kind: 'merge', rev }), { icon: 'merge' }),
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
