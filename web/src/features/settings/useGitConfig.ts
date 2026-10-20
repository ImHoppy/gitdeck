import { useCallback, useEffect, useState } from 'react'
import { gitd } from '../../protocol/client'

export type ConfigScope = 'global' | 'local'

/** The editable git settings of one scope; saving a value re-reads the scope. */
export function useGitConfig(repoId: number | null, scope: ConfigScope) {
  const [values, setValues] = useState<Record<string, string> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const id = scope === 'local' ? repoId : (repoId ?? undefined)

  useEffect(() => {
    if (scope === 'local' && repoId === null) return
    let live = true
    gitd.call<Record<string, string>>('gitConfig.get', { id, scope }).then(
      (v) => live && setValues(v),
      (e: Error) => live && setError(e.message),
    )
    return () => {
      live = false
    }
  }, [id, scope, repoId])

  const set = useCallback(
    async (key: string, value: string) => {
      setError(null)
      try {
        setValues(await gitd.call<Record<string, string>>('gitConfig.set', { id, scope, key, value }))
      } catch (e) {
        setError((e as Error).message)
      }
    },
    [id, scope],
  )

  return { values, error, set }
}
