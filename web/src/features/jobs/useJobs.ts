import { useCallback, useEffect, useState } from 'react'
import { gitd } from '../../protocol/client'
import type { JobUpdate } from '../../protocol/types'
import { mergeJob } from './jobLines'

const SHOW_AFTER_MS = 1500

export type Job = JobUpdate & { shown: boolean; dismissed: boolean }

function failed(j: JobUpdate): boolean {
  return j.done !== null && !['done', 'upToDate', 'skipped'].includes(j.done.kind)
}

export function useJobs() {
  const [jobs, setJobs] = useState<ReadonlyMap<number, Job>>(new Map())

  const patch = useCallback((id: number, change: (j: Job) => Job) => {
    setJobs((all) => {
      const j = all.get(id)
      if (!j) return all
      return new Map(all).set(id, change(j))
    })
  }, [])

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const apply = (u: JobUpdate) =>
      setJobs((all) => {
        const old = all.get(u.id)
        const merged = mergeJob(old, u)
        const shown = (old?.shown ?? false) || (failed(merged) && !merged.background)
        if (!old && !merged.done) {
          const t = setTimeout(() => {
            timers.delete(t)
            patch(u.id, (j) => (j.done ? j : { ...j, shown: true }))
          }, SHOW_AFTER_MS)
          timers.add(t)
        }
        const next = new Map(all)
        if (merged.done && !shown) next.delete(u.id)
        else next.set(u.id, { ...merged, shown, dismissed: old?.dismissed ?? false })
        return next
      })
    gitd.call<JobUpdate[]>('jobs.list').then((list) => list.forEach((u) => !u.done && apply(u)), () => {})
    const off = gitd.on<JobUpdate>('job', apply)
    return () => {
      off()
      timers.forEach(clearTimeout)
    }
  }, [patch])

  const dismiss = useCallback(
    (id: number) =>
      setJobs((all) => {
        const j = all.get(id)
        if (!j) return all
        const next = new Map(all)
        if (j.done) next.delete(id)
        else next.set(id, { ...j, dismissed: true })
        return next
      }),
    [],
  )
  const visible = [...jobs.values()].filter((j) => j.shown && !j.dismissed)
  return { visible, get: (id: number) => jobs.get(id), dismiss, failed }
}
