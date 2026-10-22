import { useCallback, useEffect, useState } from 'react'
import { pickFolder } from '../../lib/pickFolder'
import { gitd } from '../../protocol/client'
import { Button } from '../../ui/Button/Button'
import { IconButton } from '../../ui/IconButton/IconButton'
import { PanelDialog } from '../../ui/Panel/PanelDialog'
import { Spinner } from '../../ui/Spinner/Spinner'
import type { Commands } from '../repo-actions'

type Worktree = { path: string; head: string; branch: string | null; main: boolean; locked: boolean; prunable: boolean }

type Props = {
  repoId: number
  cmd: Commands
  branches: string[]
  /** Opens a worktree as a project of its own, in a new window. */
  onOpen: (path: string) => void
  onClose: () => void
}

/** `git worktree`: more checkouts of the same repository, each on its own branch. */
export function WorktreesDialog({ repoId, cmd, branches, onOpen, onClose }: Props) {
  const [list, setList] = useState<Worktree[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(() => {
    gitd.call<Worktree[]>('worktree.list', { id: repoId }).then(setList, (e: Error) => setError(e.message))
  }, [repoId])
  useEffect(reload, [reload])

  const call = async (method: string, params: object) => {
    setError(null)
    try {
      await gitd.call(method, { id: repoId, ...params })
    } catch (e) {
      setError((e as Error).message)
    }
    reload()
  }

  const add = async () => {
    const branch = await cmd.prompt('New worktree', `Branch to check out there (existing: ${branches.slice(0, 5).join(', ')}${branches.length > 5 ? '…' : ''}; a new name creates it)`)
    if (!branch) return
    const path = await cmd.prompt('New worktree', 'Folder for it (created)', '', (current) => pickFolder(current, 'Folder for the worktree'))
    if (path) await call('worktree.add', { path, branch, newBranch: !branches.includes(branch) })
  }

  return (
    <PanelDialog
      title="Worktrees"
      onClose={onClose}
      actions={
        <Button title="Check out a branch in another folder" onClick={() => void add()}>
          + Add
        </Button>
      }
    >
      {error && <p className="empty">{error}</p>}
      {!list ? (
        <p className="empty">
          <Spinner />
        </p>
      ) : (
        list.map((w) => (
          <div key={w.path} className="row">
            <span className="grow">
              <strong>{w.branch ?? `detached ${w.head.slice(0, 7)}`}</strong>
              <span className="muted" title={w.path}>
                {w.path}
                {w.main ? ' · main worktree' : ''}
                {w.locked ? ' · locked' : ''}
                {w.prunable ? ' · folder missing' : ''}
              </span>
            </span>
            {!w.main && (
              <>
                <IconButton title="Open it in a new window" onClick={() => onOpen(w.path)}>
                  Open
                </IconButton>
                <IconButton
                  title="Delete the worktree folder (the branch stays)"
                  onClick={async () => {
                    if (!(await cmd.confirm('Remove worktree?', `${w.path} is deleted; its branch stays in the repository.`, 'Remove'))) return
                    await call('worktree.remove', { path: w.path, force: w.prunable })
                  }}
                >
                  Remove
                </IconButton>
              </>
            )}
          </div>
        ))
      )}
    </PanelDialog>
  )
}
