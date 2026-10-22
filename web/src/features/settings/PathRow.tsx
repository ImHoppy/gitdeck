import { useState } from 'react'
import { Button } from '../../ui/Button/Button'
import styles from './SettingsPage.module.css'

type Props = {
  label: string
  placeholder: string
  path: string | null
  /** Shown under the field: what the current value resolves to. */
  status: string
  /** Resolves to an error message, or null once saved. */
  onSave: (path: string) => Promise<string | null>
}

/** A saved path setting (git, editor): edited as text, applied on Save or Enter. */
export function PathRow({ label, placeholder, path, status, onSave }: Props) {
  const [draft, setDraft] = useState(path ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const changed = draft.trim() !== (path ?? '')

  const save = async () => {
    setBusy(true)
    setError(await onSave(draft))
    setBusy(false)
  }

  return (
    <div className={styles.gitPath}>
      <span>{label}</span>
      <div className={styles.gitPathInput}>
        <input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && changed && void save()}
        />
        <Button title="Save" disabled={!changed || busy} onClick={() => void save()}>
          Save
        </Button>
      </div>
      <span className={error ? styles.error : styles.hint}>{error ?? status}</span>
    </div>
  )
}
