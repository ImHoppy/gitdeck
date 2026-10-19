import type { ChangedFile, ChangeKind } from '../../protocol/types'
import styles from './Diff.module.css'

const ICON: Record<ChangeKind, string> = {
  added: '+',
  modified: '✎',
  deleted: '−',
  renamed: '→',
  copied: '⧉',
  typeChanged: 'T',
  unmerged: '✖',
  untracked: '?',
}

type Props = {
  files: ChangedFile[]
  selected: string | null
  onSelect: (f: ChangedFile) => void
  action?: { label: string; title: string; run: (f: ChangedFile) => void }
}

export function FileList({ files, selected, onSelect, action }: Props) {
  if (files.length === 0) return <div className={styles.empty}>No files</div>
  return (
    <div className={styles.files}>
      {files.map((f) => (
        <div
          key={f.path}
          className={`${styles.file} ${f.path === selected ? styles.selected : ''}`}
          onClick={() => onSelect(f)}
          title={f.oldPath ? `${f.oldPath} → ${f.path}` : f.path}
        >
          <span className={`${styles.icon} ${styles[f.kind]}`}>{ICON[f.kind]}</span>
          <span className={styles.path}>{f.path}</span>
          {action && (
            <button
              className={styles.action}
              title={action.title}
              onClick={(e) => {
                e.stopPropagation()
                action.run(f)
              }}
            >
              {action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
