import { useState } from 'react'
import type { ChangedFile, DiffTarget } from '../../protocol/types'
import { formatBytes } from '../../lib/formatBytes'
import styles from './ImagePreview.module.css'

/** The two revisions a diff compares, as `/blob` names them; null where the file has no before. */
function revisions(target: DiffTarget): [string | null, string] {
  if (target.kind === 'worktree') return ['index', 'worktree']
  if (target.kind === 'index') return ['HEAD', 'index']
  return [target.parent, target.sha]
}

const url = (repoId: number, rev: string, path: string) =>
  `/blob?${new URLSearchParams({ repo: String(repoId), rev, path })}`

/** The image's file size, from the browser's record of the request (no second fetch). */
function fileSize(src: string): number | null {
  const entry = performance.getEntriesByName(src).at(-1) as PerformanceResourceTiming | undefined
  return entry?.decodedBodySize || null
}

function change(before: number, after: number): string {
  const delta = after - before
  if (delta === 0) return 'same size'
  const sign = delta > 0 ? '+' : '−'
  return `${sign}${formatBytes(delta)}, ${sign}${Math.abs(Math.round((delta / before) * 100))}%`
}

type Props = { repoId: number; file: ChangedFile; target: DiffTarget }

export function ImagePreview({ repoId, file, target }: Props) {
  const [before, after] = revisions(target)
  const old = file.kind === 'added' || file.kind === 'untracked' ? null : before
  const gone = file.kind === 'deleted'
  const oldSrc = old && url(repoId, old, file.oldPath ?? file.path)
  const newSrc = gone ? null : url(repoId, after, file.path)
  // keyed by url, so switching files never shows the last image's numbers
  const [sizes, setSizes] = useState<Record<string, number>>({})
  const onSize = (src: string, n: number) => setSizes((s) => (s[src] === n ? s : { ...s, [src]: n }))
  const a = oldSrc ? sizes[oldSrc] : undefined
  const b = newSrc ? sizes[newSrc] : undefined
  return (
    <div className={styles.preview}>
      {oldSrc && <Side key={oldSrc} label={gone ? 'Deleted' : 'Before'} src={oldSrc} onSize={onSize} />}
      {newSrc && <Side key={newSrc} label={oldSrc ? 'After' : 'New'} src={newSrc} onSize={onSize} note={a !== undefined && b !== undefined ? change(a, b) : null} />}
    </div>
  )
}

type SideProps = { label: string; src: string; onSize: (src: string, bytes: number) => void; note?: string | null }

function Side({ label, src, onSize, note }: SideProps) {
  const [info, setInfo] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  return (
    <figure className={styles.side}>
      <figcaption>
        {label}
        {info && ` · ${info}`}
        {note && ` (${note})`}
      </figcaption>
      {failed ? (
        <div className={styles.missing}>Could not load the image</div>
      ) : (
        <img
          src={src}
          alt={label}
          onLoad={(e) => {
            const { naturalWidth: w, naturalHeight: h, currentSrc } = e.currentTarget
            const n = fileSize(currentSrc)
            if (n) onSize(src, n)
            setInfo([`${w} × ${h}`, n && formatBytes(n)].filter(Boolean).join(' · '))
          }}
          onError={() => setFailed(true)}
        />
      )}
    </figure>
  )
}
