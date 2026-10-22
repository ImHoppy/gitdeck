import { type ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { isMac } from '../../lib/platform'
import { Icon } from '../Icon/Icon'
import { Spinner } from '../Spinner/Spinner'
import { trackToast } from './openToasts'
import styles from './Toast.module.css'

export type ToastTone = 'info' | 'ok' | 'bad' | 'busy'

type Props = {
  tone: ToastTone
  title: ReactNode
  children?: ReactNode
  onDismiss?: () => void
  /** Dismisses itself after this many ms. */
  autoHide?: number
}

const MARK = { info: 'info', ok: 'checkout', bad: 'alert' } as const

let host: HTMLDivElement | null = null

function stack(): HTMLDivElement {
  if (!host) {
    host = document.createElement('div')
    host.className = styles.stack
    host.setAttribute('aria-live', 'polite')
    document.body.appendChild(host)
  }
  return host
}

export function Toast({ tone, title, children, onDismiss, autoHide }: Props) {
  const dismiss = useRef(onDismiss)
  useEffect(() => {
    dismiss.current = onDismiss
  }, [onDismiss])
  const dismissable = !!onDismiss
  useEffect(() => (dismissable ? trackToast(Symbol('toast'), () => dismiss.current?.()) : undefined), [dismissable])
  useEffect(() => {
    if (!autoHide) return
    const t = setTimeout(() => dismiss.current?.(), autoHide)
    return () => clearTimeout(t)
  }, [autoHide])

  const close = onDismiss && (
    <button className={styles.close} title="Dismiss" onClick={onDismiss}>
      <Icon name="close" size={11} />
    </button>
  )
  return createPortal(
    <div className={`${styles.toast} ${styles[tone]}`} role={tone === 'bad' ? 'alert' : 'status'}>
      <div className={`${styles.head} ${isMac ? styles.mac : ''}`}>
        {isMac && close}
        <span className={styles.mark}>{tone === 'busy' ? <Spinner /> : <Icon name={MARK[tone]} size={13} />}</span>
        <span className={styles.title}>{title}</span>
        {!isMac && close}
      </div>
      {children && <div className={styles.body}>{children}</div>}
    </div>,
    stack(),
  )
}
