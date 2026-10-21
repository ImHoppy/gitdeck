import { useState } from 'react'
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
