import { useCallback, useEffect, useState } from 'react'
import { setAvatarsEnabled } from '../../lib/avatarSource'
import { gitd } from '../../protocol/client'

export type ServerInfo = { keepRunning: boolean; version: string; git: string | null; gitVersion: string | null; githubAvatars: boolean; editor: string | null; fileManager: string | null }

export function useServerInfo() {
  const [info, setInfo] = useState<ServerInfo | null>(null)

  useEffect(() => {
    gitd.call<ServerInfo>('server.info').then(setInfo, () => setInfo(null))
  }, [])

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

  return { info, setKeepRunning, setGit, setGithubAvatars, setEditor, setFileManager }
}
