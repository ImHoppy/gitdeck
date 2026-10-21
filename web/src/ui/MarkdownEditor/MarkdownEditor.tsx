import { type ReactNode, useRef, useState } from 'react'
import { Icon } from '../Icon/Icon'
import { type Edit, insertBlock, link, wrap } from './editing'
import styles from './MarkdownEditor.module.css'

type Props = {
  value: string
  onChange: (text: string) => void
  /** Ctrl+Enter. */
  onSubmit?: () => void
  placeholder?: string
  /** Uploads pasted, dropped or picked files; answers the markdown to insert for each. */
  onAttach?: (files: File[]) => Promise<string[]>
  /** Why pictures can't be attached here, shown instead of the attach button. */
  attachHint?: string
  preview: (text: string) => ReactNode
  autoFocus?: boolean
  rows?: number
  /** Buttons beside the tabs (submit, cancel). */
  actions?: ReactNode
}

const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,video/mp4,video/quicktime'

/** A plain textarea with Write / Preview tabs, for PR bodies and comments. */
export function MarkdownEditor({ value, onChange, onSubmit, placeholder, onAttach, attachHint, preview, autoFocus, rows = 5, actions }: Props) {
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)
  const picker = useRef<HTMLInputElement>(null)

  const apply = (e: Edit) => {
    onChange(e.text)
    requestAnimationFrame(() => {
      area.current?.focus()
      area.current?.setSelectionRange(e.start, e.end)
    })
  }

  const attach = async (files: File[]) => {
    if (!onAttach || files.length === 0) return
    setUploading(true)
    setError(null)
    try {
      const snippets = await onAttach(files)
      const at = area.current?.selectionStart ?? value.length
      apply(insertBlock(value, at, snippets.join('\n')))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const t = e.currentTarget
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      onSubmit?.()
      return
    }
    if (!(e.ctrlKey || e.metaKey)) return
    const k = e.key.toLowerCase()
    if (k === 'b' || k === 'i' || k === 'k') {
      e.preventDefault()
      apply(k === 'k' ? link(value, t.selectionStart, t.selectionEnd) : wrap(value, t.selectionStart, t.selectionEnd, k === 'b' ? '**' : '_'))
    }
  }

  return (
    <div className={styles.editor}>
      <div className={styles.bar}>
        <button className={tab === 'write' ? styles.active : ''} onClick={() => setTab('write')}>Write</button>
        <button className={tab === 'preview' ? styles.active : ''} onClick={() => setTab('preview')}>Preview</button>
        <span className={styles.spacer} />
        {onAttach ? (
          <button className={styles.attach} title="Attach pictures or videos (or paste, or drop)" disabled={uploading} onClick={() => picker.current?.click()}>
            <Icon name="file" size={12} /> {uploading ? 'Uploading…' : 'Attach'}
          </button>
        ) : (
          attachHint && <span className={styles.hint}>{attachHint}</span>
        )}
        <input
          ref={picker}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            void attach([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />
      </div>
      {tab === 'write' ? (
        <textarea
          ref={area}
          className={styles.text}
          value={value}
          rows={rows}
          autoFocus={autoFocus}
          placeholder={placeholder ?? 'Markdown: **bold**, _italic_, `code`, #123 … Ctrl+Enter sends'}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          onPaste={(e) => {
            const files = [...e.clipboardData.files]
            if (files.length && onAttach) {
              e.preventDefault()
              void attach(files)
            }
          }}
          onDragOver={(e) => onAttach && e.dataTransfer.types.includes('Files') && e.preventDefault()}
          onDrop={(e) => {
            if (!onAttach || e.dataTransfer.files.length === 0) return
            e.preventDefault()
            void attach([...e.dataTransfer.files])
          }}
        />
      ) : (
        <div className={styles.preview}>{value.trim() ? preview(value) : <span className={styles.hint}>Nothing to preview</span>}</div>
      )}
      {(error || actions) && (
        <div className={styles.footer}>
          {error && <span className={styles.error}>{error}</span>}
          <span className={styles.spacer} />
          {actions}
        </div>
      )}
    </div>
  )
}
