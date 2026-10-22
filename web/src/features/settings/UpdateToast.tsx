import { useState } from 'react'
import { Button } from '../../ui/Button/Button'
import { Toast } from '../../ui/Toast/Toast'
import type { UpdateState } from './useServerInfo'
import styles from './UpdateToast.module.css'

type Props = {
  state: UpdateState
  /** Each resolves to an error message, or null. */
  onInstall: () => Promise<string | null>
  onRestart: () => Promise<string | null>
}

/** A new version waiting for a click, shown on open and when it turns up; dismissed per version. */
export function UpdateToast({ state, onInstall, onRestart }: Props) {
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (state.kind !== 'available' && state.kind !== 'installed') return null
  const key = `${state.kind}:${state.version}`
  if (dismissed === key) return null
  const installed = state.kind === 'installed'
  const run = async (action: () => Promise<string | null>) => setError(await action())

  return (
    <Toast tone={error ? 'bad' : 'info'} title={installed ? `gitdeck ${state.version} is installed` : `gitdeck ${state.version} is available`} onDismiss={() => setDismissed(key)}>
      <div className={styles.content}>
        <span className={styles.text}>{error ?? (installed ? 'Restart gitd to start using it.' : 'Download it now, then restart.')}</span>
        {installed ? (
          <Button primary title="Restart gitd on the new version" onClick={() => void run(onRestart)}>
            Restart now
          </Button>
        ) : (
          <Button primary title={`Download and install gitdeck ${state.version}`} onClick={() => void run(onInstall)}>
            Install
          </Button>
        )}
      </div>
    </Toast>
  )
}
