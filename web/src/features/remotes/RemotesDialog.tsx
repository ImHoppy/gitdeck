import type { Commands } from '../repo-actions'
import { IconButton } from '../../ui/IconButton/IconButton'
import { PanelDialog } from '../../ui/Panel/PanelDialog'
import { Spinner } from '../../ui/Spinner/Spinner'
import { useRemotes } from './useRemotes'

type Props = { repoId: number; cmd: Commands; onClose: () => void }

/** Git Extensions' "Manage remote repositories": add, rename, change the URL, fetch, prune, remove. */
export function RemotesDialog({ repoId, cmd, onClose }: Props) {
  const { remotes, error, reload } = useRemotes(repoId)
  const then = (p: Promise<unknown>) => void p.then(reload)

  const add = async () => {
    const url = await cmd.prompt('Add remote', 'URL or path of the remote repository')
    if (!url) return
    const name = await cmd.prompt('Add remote', 'Name for it', remotes?.length ? 'upstream' : 'origin')
    if (name) then(cmd.run(`add remote ${name}`, { kind: 'addRemote', name, url }))
  }

  return (
    <PanelDialog
      title="Remotes"
      onClose={onClose}
      actions={
        <IconButton title="Add a remote" onClick={() => void add()}>
          + Add
        </IconButton>
      }
    >
      {error && <p className="empty">{error}</p>}
      {!remotes ? (
        <p className="empty">
          <Spinner />
        </p>
      ) : remotes.length === 0 ? (
        <p className="empty">No remote yet: add one to push and pull.</p>
      ) : (
        remotes.map((r) => (
          <div key={r.name} className="row">
            <span className="grow">
              <strong>{r.name}</strong>
              <span className="muted" title={r.fetchUrl}>
                {r.fetchUrl}
              </span>
              {r.pushUrl && r.pushUrl !== r.fetchUrl && <span className="muted">push: {r.pushUrl}</span>}
            </span>
            <IconButton title={`Fetch ${r.name} and drop its deleted branches`} onClick={() => then(cmd.run(`fetch ${r.name}`, { kind: 'fetchRemote', name: r.name }))}>
              Fetch
            </IconButton>
            <IconButton title="Drop remote-tracking branches deleted on the remote" onClick={() => then(cmd.run(`prune ${r.name}`, { kind: 'pruneRemote', name: r.name }))}>
              Prune
            </IconButton>
            <IconButton
              title="Change the URL"
              onClick={async () => {
                const url = await cmd.prompt(`URL of ${r.name}`, 'New URL', r.fetchUrl)
                if (url && url !== r.fetchUrl) then(cmd.run(`set url of ${r.name}`, { kind: 'setRemoteUrl', name: r.name, url }))
              }}
            >
              URL…
            </IconButton>
            <IconButton
              title="Rename"
              onClick={async () => {
                const to = await cmd.prompt(`Rename ${r.name}`, 'New name', r.name)
                if (to && to !== r.name) then(cmd.run(`rename ${r.name}`, { kind: 'renameRemote', from: r.name, to }))
              }}
            >
              Rename…
            </IconButton>
            <IconButton
              title="Remove this remote and its remote-tracking branches"
              onClick={async () => {
                if (await cmd.confirm('Remove remote?', `${r.name} and its remote-tracking branches are removed here; nothing changes on the server.`, 'Remove')) {
                  then(cmd.run(`remove ${r.name}`, { kind: 'removeRemote', name: r.name }))
                }
              }}
            >
              Remove
            </IconButton>
          </div>
        ))
      )}
    </PanelDialog>
  )
}
