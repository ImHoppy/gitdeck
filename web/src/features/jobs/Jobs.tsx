import { useState } from 'react'
import { useStatusItem } from '../../lib/statusBar'
import type { JobUpdate } from '../../protocol/types'
import { JobConsole } from './JobConsole'
import { JobGroupToast } from './JobGroupToast'
import { JobToast } from './JobToast'
import { useJobs } from './useJobs'

const GROUP_FROM = 2

export function Jobs() {
  const [openId, setOpenId] = useState<number | null>(null)
  const jobs = useJobs(openId)
  const running = jobs.visible.filter((j) => !j.done)
  const grouped = running.length > GROUP_FROM
  const single = grouped ? jobs.visible.filter((j) => j.done) : jobs.visible
  const [kept, setKept] = useState<JobUpdate | null>(null)
  const open = (openId === null ? undefined : jobs.get(openId)) ?? kept
  const all = jobs.visible.filter((j) => !j.done)
  useStatusItem(
    all.length
      ? {
          id: 'jobs',
          side: 'right',
          order: 20,
          tone: 'busy',
          text: all.length === 1 ? all[0].title : `${all.length} jobs`,
          title: `${all.map((j) => j.title).join(', ')} (click: output)`,
          onClick: () => setOpenId(all[0].id),
        }
      : null,
  )

  return (
    <>
      {grouped && <JobGroupToast jobs={running} onOpen={setOpenId} onDismiss={() => running.forEach((j) => jobs.dismiss(j.id))} />}
      {single.map((j) => (
        <JobToast key={j.id} job={j} failed={jobs.failed(j)} onOpen={() => setOpenId(j.id)}
          onDismiss={() => {
            if (j.id === openId) setKept(j)
            jobs.dismiss(j.id)
          }}
        />
      ))}
      {openId !== null && open && (
        <JobConsole
          job={open}
          failed={jobs.failed(open)}
          onClose={() => {
            setOpenId(null)
            setKept(null)
          }}
        />
      )}
    </>
  )
}
