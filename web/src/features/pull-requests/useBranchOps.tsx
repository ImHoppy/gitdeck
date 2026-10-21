import { useEffect, useState } from 'react'
import type { PrDetail, PrHead } from '../../protocol/github'
import type { RepoSnapshot } from '../../protocol/types'
import { useRepoCommands } from '../repo-actions'
import { ClashDialog } from './ClashDialog'
import type { ActionResult } from './usePrActions'
import { useSwitch } from './usePrActions'

export type LocalRepo = { id: number; remote: string; repo: RepoSnapshot | null }

type Deps = {
  local: LocalRepo | null
  detail: PrDetail | null
  confirm: (title: string, body: string, ok?: string) => Promise<boolean>
  report: (r: ActionResult) => void
  /** After a switch: show the branch in the history. */
  onSwitched: (branch: string) => void
}

const head = (d: PrDetail): PrHead => ({
  number: d.number,
  headRefName: d.headRefName,
  isCrossRepository: d.isCrossRepository,
  maintainerCanModify: d.maintainerCanModify,
  headRepo: d.headRepo ? `${d.headRepo.owner}/${d.headRepo.name}` : null,
})

/** Switching to the PR's branch and back, rebasing it and pushing it, all plain git through gitd. */
export function useBranchOps({ local, detail, confirm, report, onSwitched }: Deps) {
  const sw = useSwitch(local?.id ?? null)
  const cmd = useRepoCommands(local?.id ?? -1)
  const [clash, setClash] = useState<{ branch: string; separate: string; stash: boolean } | null>(null)
  const { refresh } = sw
  useEffect(refresh, [refresh])

  const current = local?.repo?.state?.head.kind === 'branch' ? local.repo.state.head.name : null
  const checkedOut = !!detail && !!current && (current === detail.headRefName || current.startsWith(`pr/${detail.number}-`))
  const busyOp = local?.repo?.state?.operation ?? null

  const switchTo = async (opts: { stash?: boolean; choice?: 'useExisting' | 'separate' } = {}) => {
    if (!detail || !local) return
    const out = await sw.switchTo(head(detail), local.remote, opts)
    if (out.kind === 'dirty') {
      const ok = await confirm('Uncommitted changes', 'Stash them and switch? They are popped back when you switch back (kept in the stash on a conflict).', 'Stash and switch')
      if (ok) await switchTo({ ...opts, stash: true })
    } else if (out.kind === 'clash') {
      setClash({ branch: out.branch, separate: out.separate, stash: !!opts.stash })
    } else if (out.kind === 'switched') {
      report({ ok: true, text: `On ${out.branch}${out.stash ? ' (your changes are stashed)' : ''}` })
      onSwitched(out.branch)
    } else {
      report({ ok: false, text: `Switch: ${out.kind === 'failed' ? out.message : out.reason}` })
    }
  }

  const back = async () => {
    const out = await sw.back()
    if (out.kind === 'done' || out.kind === 'upToDate') report({ ok: true, text: `Back on ${sw.from?.previous ?? 'your branch'}` })
    else report({ ok: false, text: `Switch back: ${out.kind === 'failed' ? out.message : out.kind === 'skipped' ? out.reason : out.kind}` })
  }

  const button = !local || !detail
    ? null
    : checkedOut && sw.from
      ? { label: `Switch back to ${sw.from.previous}`, title: 'Back to the branch you left, with its stashed changes', disabled: sw.busy || !!busyOp, run: () => void back() }
      : checkedOut
        ? { label: 'Checked out', title: `${current} is checked out`, disabled: true, run: () => {} }
        : { label: 'Switch to this branch', title: busyOp ? `${busyOp} in progress` : 'Fetch the PR head and switch to it (Ctrl+Shift+S)', disabled: sw.busy || !!busyOp, run: () => void switchTo() }

  const rebaseOntoBase = async () => {
    if (!detail || !local) return
    const fetched = await cmd.run('fetch', { kind: 'fetchRemote', name: local.remote })
    if (fetched.kind !== 'done' && fetched.kind !== 'upToDate') return report({ ok: false, text: 'Fetch failed' })
    const out = await cmd.run('rebase', { kind: 'rebase', onto: `${local.remote}/${detail.baseRefName}` })
    if (out.kind === 'conflict') report({ ok: false, text: 'Rebase stopped on a conflict: resolve it in the history view' })
    else if (out.kind === 'done' || out.kind === 'upToDate') report({ ok: true, text: `Rebased onto ${detail.baseRefName}: push the rebased branch next` })
    else report({ ok: false, text: `Rebase: ${out.kind === 'failed' ? out.message : out.kind}` })
  }

  const pushRebased = async () => {
    if (!detail || !local) return
    const ok = await confirm(
      `Force push #${detail.number}?`,
      `${detail.headRefName} on ${local.remote} is replaced by your rebased branch. Refused if anyone pushed since ${detail.headRefOid.slice(0, 7)}.`,
      'Push rebased branch',
    )
    if (!ok) return
    const out = await cmd.run('push', { kind: 'pushLease', remote: local.remote, branch: detail.headRefName, expect: detail.headRefOid })
    report(out.kind === 'done' || out.kind === 'upToDate' ? { ok: true, text: 'Pushed the rebased branch' } : { ok: false, text: `Push: ${out.kind === 'failed' ? out.message : out.kind}` })
  }

  const dialog = clash && (
    <ClashDialog
      branch={clash.branch}
      separate={clash.separate}
      onPick={(choice) => {
        const stash = clash.stash
        setClash(null)
        if (choice) void switchTo({ choice, stash })
      }}
    />
  )

  return { button, checkedOut, current, rebaseOntoBase, pushRebased, switchTo, dialog, busy: sw.busy || cmd.busy }
}
