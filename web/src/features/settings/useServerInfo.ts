import { useCallback, useEffect, useState } from 'react'
import { setAvatarsEnabled } from '../../lib/avatarSource'
import { gitd } from '../../protocol/client'

export type ServerInfo = { keepRunning: boolean; version: string; git: string | null; gitVersion: string | null; githubAvatars: boolean; editor: string | null; fileManager: string | null; fetchInterval: number | null }

export function useServerInfo() {
  const [info, setInfo] = useState<ServerInfo | null>(null)

  const reload = useCallback(() => {
    gitd.call<ServerInfo>('server.info').then(setInfo, () => setInfo(null))
  }, [])

  useEffect(reload, [reload])

  useEffect(() => setAvatarsEnabled(info?.githubAvatars ?? false), [info])

  const setKeepRunning = useCallback((on: boolean) => {
    gitd.call<ServerInfo>('server.keepRunning', { on }).then(setInfo, () => {})
  }, [])

  const setGit = useCallback(async (path: string): Promise<string | null> => {
    try {
      setInfo(await gitd.call<ServerInfo>('server.setGit', { path }))
      return null
    } catch (e) {
      return (e as Error).message
    }
  }, [])

  const setGithubAvatars = useCallback((on: boolean) => {
    gitd.call<ServerInfo>('server.setAvatars', { on }).then(setInfo, () => {})
  }, [])

  const setEditor = useCallback(async (path: string): Promise<string | null> => {
    try {
      setInfo(await gitd.call<ServerInfo>('server.setEditor', { path }))
      return null
    } catch (e) {
      return (e as Error).message
    }
  }, [])

  const setFileManager = useCallback(async (path: string): Promise<string | null> => {
    try {
      setInfo(await gitd.call<ServerInfo>('server.setFileManager', { path }))
      return null
    } catch (e) {
      return (e as Error).message
    }
  }, [])

  const setFetchInterval = useCallback((minutes: number) => {
    gitd.call<ServerInfo>('server.setFetchInterval', { minutes }).then(setInfo, () => {})
  }, [])

  return { info, reload, setFetchInterval, setKeepRunning, setGit, setGithubAvatars, setEditor, setFileManager }
}
