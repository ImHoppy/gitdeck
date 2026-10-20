import { useState } from 'react'
import { avatarColor, initials, isBot } from '../../lib/avatar'
import { avatarUrl, useAvatarsEnabled } from '../../lib/avatarSource'
import styles from './Avatar.module.css'

export function Avatar({ name, email, size = 16 }: { name: string; email: string; size?: number }) {
  const pictures = useAvatarsEnabled()
  // the email a picture failed for: initials until another author is shown here
  const [missing, setMissing] = useState<string | null>(null)
  if (isBot(name, email)) {
    return (
      <span className={`${styles.avatar} ${styles.bot}`} style={{ width: size, height: size }} title={`${name} (bot)`}>
        <svg viewBox="0 0 16 16" width={size * 0.75} height={size * 0.75} aria-hidden="true">
          <rect x="3" y="5" width="10" height="8" rx="2" fill="currentColor" />
          <rect x="7.25" y="2" width="1.5" height="3" fill="currentColor" />
          <circle cx="6" cy="9" r="1.2" fill="var(--bg)" />
          <circle cx="10" cy="9" r="1.2" fill="var(--bg)" />
        </svg>
      </span>
    )
  }
  if (pictures && email && missing !== email) {
    return (
      <img
        className={styles.picture}
        src={avatarUrl(email)}
        width={size}
        height={size}
        loading="lazy"
        alt=""
        title={`${name} <${email}>`}
        onError={() => setMissing(email)}
      />
    )
  }
  return (
    <span
      className={styles.avatar}
      style={{ width: size, height: size, background: avatarColor(email || name), fontSize: size * 0.5 }}
      title={`${name} <${email}>`}
    >
      {initials(name)}
    </span>
  )
}
