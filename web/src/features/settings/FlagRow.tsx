import { useState } from 'react'
import styles from './SettingsPage.module.css'

type Props = {
  label: string
  checked: boolean
  /** Resolves to an error message, or null once applied. */
  onChange: (on: boolean) => Promise<string | null>
}

/** A checkbox applied on the host (registry, login items), which can fail. */
export function FlagRow({ label, checked, onChange }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const change = async (on: boolean) => {
    setBusy(true)
    setError(await onChange(on))
    setBusy(false)
  }

  return (
    <div className={styles.flag}>
      <label className={styles.row}>
        <span>{label}</span>
        <input type="checkbox" checked={checked} disabled={busy} onChange={(e) => void change(e.target.checked)} />
      </label>
      {error && <span className={styles.error}>{error}</span>}
    </div>
  )
}
