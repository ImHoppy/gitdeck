import type { ReactNode } from 'react'
import type { ChangedFile } from '../../protocol/types'
import { IconButton } from '../../ui/IconButton/IconButton'
import { type FileAction, FileList, type FileListMode } from '../diff'
import styles from './CommitDialog.module.css'

type Props = {
  title: string
  files: ChangedFile[] | null
  selected: string | null
  onSelect: (f: ChangedFile) => void
  mode: FileListMode
  all: { label: ReactNode; title: string; disabled: boolean; run: () => void }[]
  actions: FileAction[]
  onContextMenu?: (files: ChangedFile[], at: { x: number; y: number }) => void
}

export function ChangeList({ title, files, selected, onSelect, mode, all, actions, onContextMenu }: Props) {
  return (
    <>
      <div className={styles.listHeader}>
        <span>
          {title} ({files?.length ?? 0})
        </span>
        <span className={styles.headerTools}>
          {all.map((a) => (
            <IconButton key={a.title} title={a.title} disabled={a.disabled || !files?.length} onClick={a.run}>
              {a.label}
            </IconButton>
          ))}
        </span>
      </div>
      <div className={styles.list}>
        <FileList files={files ?? []} selected={selected} onSelect={onSelect} mode={mode} actions={actions} onContextMenu={onContextMenu} />
      </div>
    </>
  )
}
