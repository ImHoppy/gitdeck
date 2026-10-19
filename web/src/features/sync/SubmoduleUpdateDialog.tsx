import { useState } from 'react'
import type { RepoResult, RepoSnapshot } from '../../protocol/types'
import { Dialog } from '../../ui/Dialog/Dialog'
import { IconButton } from '../../ui/IconButton/IconButton'

type Props = {
  moved: RepoResult[]
  repos: RepoSnapshot[]
  onAnswer: (update: boolean, remember: boolean) => void
}

export function SubmoduleUpdateDialog({ moved, repos, onAnswer }: Props) {
  const [remember, setRemember] = useState(false)
  const names = new Map(repos.map((r) => [r.id, r.pathInParent ?? r.name]))
  return (
    <Dialog
      title="Update submodules?"
      actions={
        <>
          <label>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember my
            choice
          </label>
          <IconButton title="Leave submodules where they are" onClick={() => onAnswer(false, remember)}>
            Not now
          </IconButton>
          <IconButton title="git submodule update --init --recursive" onClick={() => onAnswer(true, remember)}>
            Update
          </IconButton>
        </>
      }
    >
      <p>The pull moved submodule pointers. Check out the recorded commits now?</p>
      {moved.map((r) => (
        <div key={r.id}>
          <strong>{names.get(r.id) ?? r.id}</strong>: {r.submodulesMoved.join(', ')}
        </div>
      ))}
    </Dialog>
  )
}
