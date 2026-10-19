import { useCallback, useState } from 'react'
import { gitd } from '../../protocol/client'
import type { ChangedFile } from '../../protocol/types'

export type LineMode = 'stage' | 'unstage' | 'reset'

export function useLineStaging(repoId: number) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apply = useCallback(
    async (file: ChangedFile, mode: LineMode, diffId: string, lines: ReadonlySet<number>): Promise<boolean> => {
      setBusy(true)
      try {
        await gitd.call('stage.lines', { id: repoId, file, mode, diffId, lines: [...lines] })
        setError(null)
        return true
      } catch (e) {
        setError((e as Error).message)
        return false
      } finally {
        setBusy(false)
      }
    },
    [repoId],
  )

  return { busy, error, apply }
}
