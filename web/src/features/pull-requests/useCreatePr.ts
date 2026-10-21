import { useCallback, useEffect, useState } from 'react'
import { gitd } from '../../protocol/client'
import type { CreateResult, RepoInfo } from '../../protocol/github'

/** "fix/auto-fetch-backoff" → "Fix auto fetch backoff", when there is no commit message to use. */
export const titleFromBranch = (branch: string) => {
  const words = (branch.split('/').pop() ?? branch).replace(/[-_]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export type NewPrForm = { title: string; body: string; base: string; head: string; draft: boolean }

/** The new-PR form's defaults (key the form by `head`): base from GitHub, title and body from the last commit when it is on that branch. */
export function useCreatePr(repoId: number, repo: string, head: string, headIsCurrent: boolean) {
  const [form, setForm] = useState<NewPrForm>({ title: titleFromBranch(head), body: '', base: '', head, draft: false })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    gitd.call<RepoInfo>('pr.repoInfo', { id: repoId, repo }).then(
      (info) => setForm((f) => (f.base ? f : { ...f, base: info.defaultBranch })),
      () => {},
    )
    if (!headIsCurrent) return
    gitd.call<string>('commit.lastMessage', { id: repoId }).then((message) => {
      const [subject, ...rest] = message.split('\n')
      if (subject.trim()) setForm((f) => ({ ...f, title: subject.trim(), body: rest.join('\n').trim() }))
    }, () => {})
  }, [repoId, repo, head, headIsCurrent])

  const create = useCallback(
    async (draft: string): Promise<number | null> => {
      setBusy(true)
      setError(null)
      try {
        const r = await gitd.call<CreateResult>('pr.create', { id: repoId, repo, pr: form, draft })
        if (r.outcome.kind === 'done' && r.number) return r.number
        setError(r.outcome.kind === 'failed' ? r.outcome.message : r.outcome.kind === 'skipped' ? r.outcome.reason : `push: ${r.outcome.kind}`)
        return null
      } catch (e) {
        setError((e as Error).message)
        return null
      } finally {
        setBusy(false)
      }
    },
    [repoId, repo, form],
  )

  return { form, setForm, error, busy, create }
}
