import { useState } from 'react'
import { Dialog } from '../../ui/Dialog/Dialog'
import dialog from '../../ui/Dialog/Dialog.module.css'
import { Button } from '../../ui/Button/Button'
import { BrowseButton } from '../../ui/Dialog/BrowseButton'
import { pickFolder } from '../../lib/pickFolder'

type Props = {
  dirName: (url: string) => Promise<string>
  onClone: (url: string, path: string) => void
  onCancel: () => void
}

const join = (dir: string, name: string) => (dir && name ? `${dir.replace(/[\\/]+$/, '')}/${name}` : '')

export function CloneDialog({ dirName, onClone, onCancel }: Props) {
  const [url, setUrl] = useState('')
  const [parent, setParent] = useState('')
  const [name, setName] = useState('')
  const [named, setNamed] = useState(false)
  const target = join(parent.trim(), name.trim())

  const changeUrl = async (next: string) => {
    setUrl(next)
    if (!named) setName(next.trim() ? await dirName(next.trim()) : '')
  }

  return (
    <Dialog
      title="Clone a repository"
      actions={
        <>
          <Button title="Cancel" onClick={onCancel}>
            Cancel
          </Button>
          <Button primary title="Clone" disabled={!url.trim() || !target} onClick={() => onClone(url.trim(), target)}>
            Clone
          </Button>
        </>
      }
    >
      <div className={dialog.fields}>
        <label className={dialog.field}>
          Repository to clone (URL or path)
          <input autoFocus value={url} onChange={(e) => void changeUrl(e.target.value)} />
        </label>
        <label className={dialog.field}>
          Destination folder
          <span className={dialog.withButton}>
            <input value={parent} placeholder="E:/devs" onChange={(e) => setParent(e.target.value)} />
            <BrowseButton browse={pickFolder} current={parent} onPick={setParent} />
          </span>
        </label>
        <label className={dialog.field}>
          Subfolder
          <input
            value={name}
            onChange={(e) => {
              setNamed(true)
              setName(e.target.value)
            }}
          />
        </label>
        {target && <span className={dialog.hint}>Clones into {target}</span>}
      </div>
    </Dialog>
  )
}
