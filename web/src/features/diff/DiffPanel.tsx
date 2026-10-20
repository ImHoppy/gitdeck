import { Spinner } from '../../ui/Spinner/Spinner'
import { Select } from '../../ui/Select/Select'
import { useMemo, useState } from 'react'
import type { ChangedFile, DiffTarget } from '../../protocol/types'
import styles from './Diff.module.css'
import { usePaneSize } from '../../lib/usePaneSize'
import { Resizer } from '../../ui/Resizer/Resizer'
import { DiffToolbar } from './DiffToolbar'
import { FileList } from './FileList'
import { useDiffOptions } from './useDiffOptions'
import { PatchView } from './PatchView'
import { useDiffFiles } from './useDiffFiles'
import { usePatch } from './usePatch'
import { useNarrow } from '../../lib/useNarrow'
import { loadSetting } from '../../lib/storedSetting'
import { Icon } from '../../ui/Icon/Icon'
import { IconButton } from '../../ui/IconButton/IconButton'

type Props = {
  repoId: number
  target: DiffTarget
  title: string
  parents?: string[]
  /** Starts the file filter with this regex (the file history shows its one file). */
  initialQuery?: string
  onFileHistory?: (path: string) => void
  onDiffTool?: (path: string) => void
}

export function DiffPanel({ repoId, target: base, title, parents = [], initialQuery = '', onFileHistory, onDiffTool }: Props) {
  const [parentIndex, setParentIndex] = useState(0)
  const target: DiffTarget =
    base.kind === 'commit' && parents.length > 1 ? { ...base, parent: parents[parentIndex] ?? base.parent } : base
  const { files: all, error } = useDiffFiles(repoId, target)
  const [query, setQuery] = useState(initialQuery)
  const files = useMemo(() => filterFiles(all, query), [all, query])
  const [picked, setPicked] = useState<string | null>(null)
  const file: ChangedFile | null = files?.find((f) => f.path === picked) ?? files?.[0] ?? null
  const diff = useDiffOptions()
  const listWidth = usePaneSize('diffFiles', 300, 140, 900)
  const patch = usePatch(repoId, target, file, all, diff.options)
  const narrow = useNarrow()
  // on a phone the list and the patch take turns on the whole width
  const [patchOpen, setPatchOpen] = useState(false)
  const mode = useMemo(() => loadSetting('fileListMode', ['tree', 'list'] as const, 'tree'), [])

  if (error) return <div className={styles.empty}>{error}</div>
  if (!files) return <div className={styles.empty}><Spinner /></div>
  return (
    <div className={styles.panel}>
      {(!narrow || !patchOpen) && (
      <div className={styles.left} style={{ width: narrow ? '100%' : listWidth.size }}>
        <div className={styles.title} title={title}>
          ({files.length}) {title}
        </div>
        {parents.length > 1 && (
          <Select
            className={styles.fileFilter}
            value={String(parentIndex)}
            options={parents.map((p, i) => [String(i), `Diff with parent ${i + 1}: ${p.slice(0, 8)}`] as const)}
            onChange={(v) => setParentIndex(Number(v))}
          />
        )}
        <input
          className={styles.fileFilter}
          placeholder="Filter files (regex)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <FileList
          files={files}
          selected={file?.path ?? null}
          mode={mode}
          actions={[
            ...(onDiffTool ? [{ label: <Icon name="file" size={12} />, title: 'Open in the diff tool', run: (fs: ChangedFile[]) => fs.forEach((f) => onDiffTool(f.path)) }] : []),
            ...(onFileHistory ? [{ label: <Icon name="history" size={12} />, title: 'File history', run: (fs: ChangedFile[]) => fs.forEach((f) => onFileHistory(f.path)) }] : []),
          ]}
          onSelect={(f) => {
            setPicked(f.path)
            setPatchOpen(true)
          }}
        />
      </div>
      )}
      {!narrow && <Resizer axis="x" onDrag={listWidth.drag} onDone={listWidth.save} />}
      {(!narrow || patchOpen) && (
      <div className={`${styles.right} ${styles.patchView}`}>
        {narrow && (
          <div className={styles.title}>
            <IconButton title="Back to the files" onClick={() => setPatchOpen(false)}>
              <Icon name="list" size={12} /> Files
            </IconButton>{' '}
            {file?.path}
          </div>
        )}
        <DiffToolbar options={diff.options} onChange={diff.setOptions} staging={diff.isDefault || target.kind === 'commit'} />
        <div className={styles.patchBody}>
        {patch?.error && <div className={styles.empty}>{patch.error}</div>}
        {patch?.patch && file && (
          <PatchView
            repoId={repoId}
            file={file}
            patch={patch.patch}
            side={target.kind === 'commit' || !diff.isDefault ? null : target.kind}
          />
        )}
        </div>
      </div>
      )}
    </div>
  )
}

function filterFiles(files: ChangedFile[] | null, query: string): ChangedFile[] | null {
  if (!files || !query.trim()) return files
  let re: RegExp
  try {
    re = new RegExp(query, 'i')
  } catch {
    const q = query.toLowerCase()
    return files.filter((f) => f.path.toLowerCase().includes(q))
  }
  return files.filter((f) => re.test(f.path))
}
