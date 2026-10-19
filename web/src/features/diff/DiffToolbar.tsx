import type { PatchOptions } from '../../protocol/types'
import styles from './Diff.module.css'
import { CONTEXT_CHOICES } from './useDiffOptions'

type Props = { options: PatchOptions; onChange: (o: PatchOptions) => void; staging: boolean }

export function DiffToolbar({ options, onChange, staging }: Props) {
  return (
    <div className={styles.toolbar}>
      <label title="Context lines around each change">
        context{' '}
        <select value={String(options.context)} onChange={(e) => onChange({ ...options, context: Number(e.target.value) })}>
          {CONTEXT_CHOICES.map((c) => (
            <option key={c} value={c}>
              {c === '100000' ? 'whole file' : c}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={options.ignoreWhitespace}
          onChange={(e) => onChange({ ...options, ignoreWhitespace: e.target.checked })}
        />{' '}
        ignore whitespace
      </label>
      {!staging && <span className={styles.hint}>line staging needs 3 context lines and whitespace shown</span>}
    </div>
  )
}
