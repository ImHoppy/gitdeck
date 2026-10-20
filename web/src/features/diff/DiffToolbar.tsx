import type { PatchOptions } from '../../protocol/types'
import { Select } from '../../ui/Select/Select'
import styles from './Diff.module.css'
import { CONTEXT_CHOICES } from './useDiffOptions'

type Props = { options: PatchOptions; onChange: (o: PatchOptions) => void; staging: boolean }

export function DiffToolbar({ options, onChange, staging }: Props) {
  return (
    <div className={styles.toolbar}>
      <label title="Context lines around each change">
        context{' '}
        <Select
          value={String(options.context)}
          options={CONTEXT_CHOICES.map((c) => [c, c === '100000' ? 'whole file' : c] as const)}
          onChange={(c) => onChange({ ...options, context: Number(c) })}
        />
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
