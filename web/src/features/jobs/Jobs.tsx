import { useState } from 'react'
import type { JobUpdate } from '../../protocol/types'
import { JobConsole } from './JobConsole'
import { JobToast } from './JobToast'
import { useJobs } from './useJobs'

export function Jobs() {
  const jobs = useJobs()
  const [openId, setOpenId] = useState<number | null>(null)
  const [kept, setKept] = useState<JobUpdate | null>(null)
  const open = (openId === null ? undefined : jobs.get(openId)) ?? kept

  return (
    <>
      {jobs.visible.map((j) => (
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
