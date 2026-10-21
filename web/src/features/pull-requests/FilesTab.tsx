import { useMemo, useState } from 'react'
import { parseDiff } from '../../lib/diffLines'
import { usePaneSize } from '../../lib/usePaneSize'
import type { DraftThread, PrDetail, ReviewThread } from '../../protocol/github'
import type { ChangedFile, DiffTarget } from '../../protocol/types'
import { DiffViewer } from '../../ui/DiffViewer/DiffViewer'
import type { MarkdownLinks } from '../../ui/Markdown/links'
import { Resizer } from '../../ui/Resizer/Resizer'
import { Spinner } from '../../ui/Spinner/Spinner'
import { FileList, useDiffFiles, usePatch } from '../diff'
import styles from './Conversation.module.css'
import { LineComments } from './LineComments'
import type { PendingReview } from './usePendingReview'
import { threadsAt } from './timelineEntries'
import type { ConversationActions } from './TimelineEntry'

export type LinePick = { path: string; side: 'LEFT' | 'RIGHT'; line: number }

type Props = {
  repoId: number
  detail: PrDetail
  /** `merge base...head`, as fetched with plain git. */
  target: DiffTarget
  threads: ReviewThread[]
  review: PendingReview
  links: MarkdownLinks
  actions: ConversationActions & { commentNow: (t: DraftThread) => Promise<boolean> }
  initialPath: string | null
}

/** Where a diff line sits for GitHub: deleted lines on the old side, the rest on the new side. */
function place(l: ReturnType<typeof parseDiff>[number]): { side: 'LEFT' | 'RIGHT'; line: number } | null {
  if (l.kind === 'del' && l.oldNo !== null) return { side: 'LEFT', line: l.oldNo }
  if ((l.kind === 'add' || l.kind === 'ctx') && l.newNo !== null) return { side: 'RIGHT', line: l.newNo }
  return null
}

export function FilesTab({ repoId, detail, target, threads, review, links, actions, initialPath }: Props) {
  const { files, error } = useDiffFiles(repoId, target)
  const [picked, setPicked] = useState<string | null>(initialPath)
  const file: ChangedFile | null = files?.find((f) => f.path === picked) ?? files?.[0] ?? null
  const patch = usePatch(repoId, target, file, detail.headRefOid)
  const lines = useMemo(() => (patch?.patch ? parseDiff(patch.patch.text) : []), [patch])
  const onFile = useMemo(() => (file ? threadsAt(threads, file.path) : new Map<string, ReviewThread[]>()), [threads, file])
  const pendingHere = review.pending.filter((p) => p.path === file?.path)
  const [line, setLine] = useState<LinePick | null>(null)
  const listWidth = usePaneSize('prFiles', 260, 140, 700)
  const commentsHeight = usePaneSize('prLineComments', 220, 80, 900)

  if (error) return <div className={styles.empty}>{error}</div>
  if (!files) return <div className={styles.empty}><Spinner /></div>
  const lineThreads = line ? (onFile.get(`${line.side}:${line.line}`) ?? []) : []
  return (
    <div className={styles.files}>
      <div className={styles.fileList} style={{ width: listWidth.size }}>
        <FileList
          files={files}
          selected={file?.path ?? null}
          mode="tree"
          onSelect={(f) => {
            setPicked(f.path)
            setLine(null)
          }}
        />
      </div>
      <Resizer axis="x" onDrag={listWidth.drag} onDone={listWidth.save} />
      <div className={styles.diffSide}>
        <div className={styles.diffBody}>
          {patch?.error && <div className={styles.empty}>{patch.error}</div>}
          {patch?.patch && file && (
            <DiffViewer
              patch={patch.patch.text}
              path={file.path}
              gutter={(i) => {
                const at = place(lines[i])
                if (!at) return null
                const here = onFile.get(`${at.side}:${at.line}`) ?? []
                const mine = pendingHere.some((p) => p.side === at.side && p.line === at.line)
                const pick = () => setLine({ path: file.path, ...at })
                if (here.length || mine) {
                  const open = here.some((t) => !t.resolved)
                  return (
                    <button className={`${styles.bubble} ${open ? '' : styles.bubbleDone} ${mine ? styles.bubbleMine : ''}`} title="Show the comments on this line" onMouseDown={(e) => e.stopPropagation()} onClick={pick}>
                      {here.reduce((n, t) => n + t.comments.length, 0) || '✎'}
                    </button>
                  )
                }
                return <button className={styles.addLine} title="Comment on this line" onMouseDown={(e) => e.stopPropagation()} onClick={pick}>+</button>
              }}
            />
          )}
        </div>
        {line && (
          <>
            <Resizer axis="y" onDrag={(d) => commentsHeight.drag(-d)} onDone={commentsHeight.save} />
            <div className={styles.lineComments} style={{ height: commentsHeight.size }}>
              <LineComments line={line} threads={lineThreads} review={review} links={links} actions={actions} onClose={() => setLine(null)} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
