import { useState } from 'react'
import { relativeTime } from '../../lib/relativeTime'
import { Button } from '../../ui/Button/Button'
import type { UpdateMode } from './HostFlags'
import styles from './SettingsPage.module.css'
import type { UpdateState } from './useServerInfo'

type Props = {
  version: string
  state: UpdateState
  mode: UpdateMode
  /** Each resolves to an error message, or null. */
  onCheck: () => Promise<string | null>
  onInstall: () => Promise<string | null>
  onRestart: () => Promise<string | null>
}

/** The running version, with what GitHub has and the buttons to get it. */
export function UpdateRow({ version, state, mode, onCheck, onInstall, onRestart }: Props) {
  const [error, setError] = useState<string | null>(null)
  const busy = state.kind === 'checking' || state.kind === 'downloading'
  const run = async (action: () => Promise<string | null>) => setError(await action())
  const message = error ?? (state.kind === 'failed' ? state.message : null)

  return (
    <div className={styles.flag}>
      <div className={styles.row}>
        <span>Version {version}</span>
        <span className={styles.rowActions}>
          <span className={styles.hint}>{describe(state, mode)}</span>
          {state.kind === 'available' && (
            <Button primary title={`Download and install gitdeck ${state.version}`} onClick={() => void run(onInstall)}>
              Install
            </Button>
          )}
          {state.kind === 'installed' && (
            <Button primary title="Restart gitd on the new version (open windows reload)" onClick={() => void run(onRestart)}>
              Restart
            </Button>
          )}
          <Button title="Look for a new release on GitHub now" disabled={busy} onClick={() => void run(onCheck)}>
            Check now
          </Button>
        </span>
      </div>
      {message && <span className={styles.error}>{message}</span>}
    </div>
  )
}

function describe(state: UpdateState, mode: UpdateMode): string {
  switch (state.kind) {
    case 'checking':
      return 'Checking GitHub…'
    case 'available':
      return `${state.version} is available`
    case 'downloading':
      return `Downloading ${state.version}…`
    case 'installed':
      return `${state.version} is installed`
    case 'upToDate':
      return `Up to date (checked ${relativeTime(state.at)})`
    case 'failed':
      return 'The last update failed'
    case 'idle':
      return mode === 'off' ? 'Not checked by itself' : `Checked every 6 hours${mode === 'auto' ? ', then installed' : ''}`
  }
}
