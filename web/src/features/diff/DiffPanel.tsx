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

type Props = { repoId: number; target: DiffTarget; title: string }

export function DiffPanel({ repoId, target, title }: Props) {
  const { files: all, error } = useDiffFiles(repoId, target)
  const [query, setQuery] = useState('')
  const files = useMemo(() => filterFiles(all, query), [all, query])
  const [picked, setPicked] = useState<string | null>(null)
  const file: ChangedFile | null = files?.find((f) => f.path === picked) ?? files?.[0] ?? null
  const diff = useDiffOptions()
  const listWidth = usePaneSize('diffFiles', 300, 140, 900)
  const patch = usePatch(repoId, target, file, all, diff.options)

  if (error) return <div className={styles.empty}>{error}</div>
  if (!files) return <div className={styles.empty}>Loading…</div>
  return (
    <div className={styles.panel}>
      <div className={styles.left} style={{ width: listWidth.size }}>
        <div className={styles.title} title={title}>
          ({files.length}) {title}
        </div>
        <input
          className={styles.fileFilter}
          placeholder="Filter files (regex)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <FileList files={files} selected={file?.path ?? null} onSelect={(f) => setPicked(f.path)} />
      </div>
      <Resizer axis="x" onDrag={listWidth.drag} onDone={listWidth.save} />
      <div className={`${styles.right} ${styles.patchView}`}>
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
