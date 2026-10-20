import { type ReactNode, useCallback, useState } from 'react'
import { IconButton } from '../IconButton/IconButton'
import { BrowseButton } from './BrowseButton'
import { Dialog } from './Dialog'
import styles from './Dialog.module.css'

type Open =
  | { kind: 'confirm'; title: string; body: ReactNode; ok: string; resolve: (v: boolean) => void }
  | { kind: 'prompt'; title: string; label: string; value: string; browse?: Browse; allowEmpty?: boolean; resolve: (v: string | null) => void }

/** Fills the prompt from a picker (a folder dialog); null when cancelled. */
export type Browse = (current: string) => Promise<string | null>

/** In-page replacements for `confirm` / `prompt`: await them, render `element` once. */
export function useDialogs() {
  const [open, setOpen] = useState<Open | null>(null)

  const confirm = useCallback(
    (title: string, body: ReactNode, ok = 'OK') =>
      new Promise<boolean>((resolve) => setOpen({ kind: 'confirm', title, body, ok, resolve })),
    [],
  )

  const prompt = useCallback(
    (title: string, label: string, value = '', browseOrEmpty?: Browse | boolean) =>
      new Promise<string | null>((resolve) =>
        setOpen({
          kind: 'prompt',
          title,
          label,
          value,
          browse: typeof browseOrEmpty === 'function' ? browseOrEmpty : undefined,
          allowEmpty: browseOrEmpty === true,
          resolve,
        }),
      ),
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
    const submit = () => (open.value.trim() || open.allowEmpty) && close(open.resolve, open.value.trim())
    element = (
      <Dialog
        title={open.title}
        actions={
          <>
            <IconButton title="Cancel" onClick={() => close(open.resolve, null)}>
              Cancel
            </IconButton>
            <IconButton title="OK" disabled={!open.value.trim() && !open.allowEmpty} onClick={submit}>
              OK
            </IconButton>
          </>
        }
      >
        <label className={styles.field}>
          {open.label}
          <span className={styles.withButton}>
            <input
              autoFocus
              value={open.value}
              onChange={(e) => setOpen({ ...open, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
                if (e.key === 'Escape') {
                  // the page under the prompt (the commit page) would take this Escape too
                  e.stopPropagation()
                  close(open.resolve, null)
                }
              }}
            />
            {open.browse && (
              <BrowseButton
                browse={open.browse}
                current={open.value}
                onPick={(value) => setOpen((o) => (o?.kind === 'prompt' ? { ...o, value } : o))}
              />
            )}
          </span>
        </label>
      </Dialog>
    )
  }

  return { confirm, prompt, element }
}
