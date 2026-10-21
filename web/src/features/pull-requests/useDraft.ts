import { useCallback, useMemo, useState } from 'react'
import { gitd } from '../../protocol/client'

/** Pictures past this size are scaled down before upload, as a big screenshot rarely needs its pixels. */
const DOWNSCALE_BYTES = 4 * 1024 * 1024
const MAX_WIDTH = 2560

async function downscale(file: File): Promise<Blob> {
  if (file.size < DOWNSCALE_BYTES || !/^image\/(png|jpeg)$/.test(file.type)) return file
  try {
    const bitmap = await createImageBitmap(file)
    if (bitmap.width <= MAX_WIDTH) return file
    const canvas = new OffscreenCanvas(MAX_WIDTH, Math.round((bitmap.height * MAX_WIDTH) / bitmap.width))
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return await canvas.convertToBlob({ type: file.type, quality: 0.9 })
  } catch {
    return file
  }
}

export const draftUrl = (draft: string, name: string) => `/api/gh/draft?draft=${encodeURIComponent(draft)}&name=${encodeURIComponent(name)}`

/**
 * The pictures of one comment being written: kept by gitd in a folder of their own until the
 * comment is sent with `gh --attach`, referenced in the text as `./name`.
 */
export function useDraft() {
  const [id, setId] = useState(() => crypto.randomUUID())

  const upload = useCallback(
    async (files: File[]): Promise<string[]> => {
      const snippets: string[] = []
      for (const file of files) {
        const body = await downscale(file)
        const res = await fetch(`/api/gh/draft?draft=${id}&name=${encodeURIComponent(file.name || 'image.png')}`, { method: 'POST', body })
        if (!res.ok) throw new Error(await res.text())
        const { name } = (await res.json()) as { name: string }
        const alt = file.name.replace(/\.[^.]+$/, '') || 'image'
        snippets.push(`![${alt}](./${name})`)
      }
      return snippets
    },
    [id],
  )

  /** After a send: the next comment starts a new folder (gitd removed the old one). */
  const reset = useCallback(() => setId(crypto.randomUUID()), [])

  const discard = useCallback(() => {
    void gitd.call('pr.discardDraft', { draft: id }).catch(() => {})
    setId(crypto.randomUUID())
  }, [id])

  return useMemo(() => ({ id, upload, reset, discard }), [id, upload, reset, discard])
}
