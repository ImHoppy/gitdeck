import { useCallback, useState } from 'react'
import { gitd } from '../../protocol/client'

export function useCommitActions(repoId: number) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (method: string, params: object): Promise<boolean> => {
    setBusy(true)
    try {
      await gitd.call(method, { id: repoId, ...params })
      setError(null)
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }, [repoId])

  return {
    busy,
    error,
    stage: (paths: string[]) => run('stage.files', { paths }),
    unstage: (paths: string[]) => run('unstage.files', { paths }),
    commit: (message: string, amend: boolean) => run('commit.create', { message, amend }),
    lastMessage: () => gitd.call<string>('commit.lastMessage', { id: repoId }),
  }
}
