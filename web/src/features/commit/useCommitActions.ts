import { useCallback, useState } from 'react'
import { gitd } from '../../protocol/client'
import type { ChangedFile } from '../../protocol/types'

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

  const template = useCallback(() => gitd.call<string>('commit.template', { id: repoId }).catch(() => ''), [repoId])

  return {
    busy,
    error,
    stage: (paths: string[]) => run('stage.files', { paths }),
    unstage: (paths: string[]) => run('unstage.files', { paths }),
    discard: (files: ChangedFile[]) =>
      run('changes.discard', {
        paths: files.filter((f) => f.kind !== 'untracked').map((f) => f.path),
        untracked: files.filter((f) => f.kind === 'untracked').map((f) => f.path),
      }),
    commit: (message: string, amend: boolean, signOff: boolean) => run('commit.create', { message, amend, signOff }),
    template,
    lastMessage: () => gitd.call<string>('commit.lastMessage', { id: repoId }),
  }
}
