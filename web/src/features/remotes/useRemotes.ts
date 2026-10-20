import { useCallback, useEffect, useState } from 'react'
import { gitd } from '../../protocol/client'

export type Remote = { name: string; fetchUrl: string; pushUrl: string }

export function useRemotes(repoId: number) {
  const [remotes, setRemotes] = useState<Remote[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    gitd.call<Remote[]>('remote.list', { id: repoId }).then(setRemotes, (e: Error) => setError(e.message))
  }, [repoId])

  useEffect(reload, [reload])

  return { remotes, error, reload }
}
