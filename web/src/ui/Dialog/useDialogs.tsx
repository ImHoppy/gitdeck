import { type ReactNode, useCallback, useState } from 'react'
import { IconButton } from '../IconButton/IconButton'
import { Dialog } from './Dialog'
import styles from './Dialog.module.css'

type Open =
  | { kind: 'confirm'; title: string; body: ReactNode; ok: string; resolve: (v: boolean) => void }
  | { kind: 'prompt'; title: string; label: string; value: string; resolve: (v: string | null) => void }

/** In-page replacements for `confirm` / `prompt`: await them, render `element` once. */
export function useDialogs() {
  const [open, setOpen] = useState<Open | null>(null)

  const confirm = useCallback(
    (title: string, body: ReactNode, ok = 'OK') =>
      new Promise<boolean>((resolve) => setOpen({ kind: 'confirm', title, body, ok, resolve })),
    [],
  )

  const prompt = useCallback(
    (title: string, label: string, value = '') =>
      new Promise<string | null>((resolve) => setOpen({ kind: 'prompt', title, label, value, resolve })),
    [],
  )

  const close = <T,>(resolve: (v: T) => void, v: T) => {
    setOpen(null)
    resolve(v)
  }

  let element: ReactNode = null
  if (open?.kind === 'confirm') {
    element = (
      <Dialog
        title={open.title}
        actions={
          <>
            <IconButton title="Cancel" onClick={() => close(open.resolve, false)}>
              Cancel
            </IconButton>
            <IconButton title={open.ok} onClick={() => close(open.resolve, true)}>
              {open.ok}
            </IconButton>
          </>
        }
      >
        {open.body}
      </Dialog>
    )
  } else if (open?.kind === 'prompt') {
    const submit = () => open.value.trim() && close(open.resolve, open.value.trim())
    element = (
      <Dialog
        title={open.title}
        actions={
          <>
            <IconButton title="Cancel" onClick={() => close(open.resolve, null)}>
              Cancel
            </IconButton>
            <IconButton title="OK" disabled={!open.value.trim()} onClick={submit}>
              OK
            </IconButton>
          </>
        }
      >
        <label className={styles.field}>
          {open.label}
          <input
            autoFocus
            value={open.value}
            onChange={(e) => setOpen({ ...open, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              if (e.key === 'Escape') close(open.resolve, null)
            }}
          />
        </label>
      </Dialog>
    )
  }

  return { confirm, prompt, element }
}
