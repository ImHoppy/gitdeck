import { useState } from 'react'
import { Dialog } from '../../ui/Dialog/Dialog'
import { Button } from '../../ui/Button/Button'
import type { MarkdownLinks } from '../../ui/Markdown/links'
import { MarkdownText } from '../../ui/Markdown/MarkdownText'
import { MarkdownEditor } from '../../ui/MarkdownEditor/MarkdownEditor'
import dialog from '../../ui/Dialog/Dialog.module.css'
import styles from './PullRequests.module.css'

type Props = {
  title: string
  body: string
  links: MarkdownLinks
  onAttach: (files: File[]) => Promise<string[]>
  onSave: (title: string, body: string) => Promise<boolean>
  onCancel: () => void
}

export function EditPrDialog({ title: initialTitle, body: initialBody, links, onAttach, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [body, setBody] = useState(initialBody)
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    if (!(await onSave(title.trim(), body))) setSaving(false)
  }
  return (
    <Dialog
      title="Edit the pull request"
      actions={
        <>
          <Button title="Cancel" onClick={onCancel}>Cancel</Button>
          <Button primary title="Save on GitHub" disabled={saving || !title.trim()} onClick={() => void save()}>Save</Button>
        </>
      }
    >
      <div className={`${dialog.fields} ${styles.wide}`}>
        <label className={dialog.field}>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>
        <MarkdownEditor value={body} onChange={setBody} onSubmit={() => void save()} onAttach={onAttach} rows={12} preview={(t) => <MarkdownText text={t} links={links} />} />
      </div>
    </Dialog>
  )
}
