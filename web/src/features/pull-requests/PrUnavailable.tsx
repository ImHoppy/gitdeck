import type { ReactNode } from 'react'
import { IconButton } from '../../ui/IconButton/IconButton'
import styles from './PullRequests.module.css'
import type { PrAvailability } from './usePrStatus'

/** Why the PR view is empty, and what to do on the host. Gitdeck never asks for a login itself. */
export function PrUnavailable({ availability, lead }: { availability: PrAvailability; lead?: ReactNode }) {
  const { status, repos, ready } = availability
  let text: ReactNode
  if (!status) text = 'Asking gitd…'
  else if (!status.enabled) text = 'Pull requests are off. Turn them on in Settings → GitHub.'
  else if (status.gh?.kind === 'missing') text = <>The GitHub CLI isn't installed on the host. Install <code>gh</code>, then run <code>gh auth login</code> there.</>
  else if (status.gh?.kind === 'loggedOut') text = <>gh is not logged in. Run <code>gh auth login</code> on the host.</>
  else if (status.gh?.kind === 'failed') text = status.gh.message
  else if (ready && repos.length === 0) text = 'No repo of this workspace has a remote on GitHub.'
  return (
    <div className={styles.view}>
      {lead && <div className={styles.toolbar}>{lead}</div>}
      <div className={styles.unavailable}>
        <p>{text}</p>
        {status?.enabled && <IconButton title="Check gh again" onClick={availability.recheck}>Check again</IconButton>}
      </div>
    </div>
  )
}
