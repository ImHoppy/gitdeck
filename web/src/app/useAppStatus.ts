import type { PrAvailability } from '../features/pull-requests'
import { gitNotice, type useServerInfo } from '../features/settings'
import { useStatusItem } from '../lib/statusBar'
import { inGitdeckWindow } from '../lib/zoom'

type Deps = {
  server: ReturnType<typeof useServerInfo>
  onSettings: () => void
  /** The PR view's gh status; null until a project is open. */
  prs: PrAvailability | null
  onPulls: () => void
}

export function useAppStatus({ server, onSettings, prs, onPulls }: Deps) {
  const info = server.info
  useStatusItem({ id: 'settings', side: 'left', order: 100, icon: 'settings', title: 'Settings', onClick: onSettings })
  useStatusItem(
    info
      ? {
          id: 'keep-running',
          side: 'left',
          order: 90,
          icon: 'pin',
          text: info.keepRunning ? 'kept' : undefined,
          title: info.keepRunning ? 'gitd keeps running with no window open (click: stop after the last window)' : 'gitd stops after the last window closes (click: keep it running)',
          tone: info.keepRunning ? 'good' : 'normal',
          onClick: () => server.setKeepRunning(!info.keepRunning),
        }
      : null,
  )
  useStatusItem(
    info && inGitdeckWindow()
      ? {
          id: 'zoom',
          side: 'right',
          order: 100,
          icon: 'search',
          text: `${Math.round(info.zoom * 100)}%`,
          title: 'Zoom, Ctrl + / Ctrl - (click: back to 100%)',
          onClick: () => server.setZoom(1),
        }
      : null,
  )
  const git = gitNotice(info)
  useStatusItem(
    git ? { id: 'git', side: 'left', order: 80, icon: 'alert', text: git.short, title: `${git.text} (click: Settings)`, tone: git.tone, onClick: onSettings } : null,
  )
  const update = info?.update
  useStatusItem(
    update?.kind === 'available' || update?.kind === 'installed' || update?.kind === 'downloading'
      ? {
          id: 'update',
          side: 'right',
          order: 20,
          icon: 'refresh',
          text: { available: `gitdeck ${update.version} available`, installed: `restart for ${update.version}`, downloading: `updating to ${update.version}` }[update.kind],
          title: {
            available: `gitdeck ${update.version} is out (click: Settings, to install it)`,
            installed: `gitdeck ${update.version} is installed (click: Settings, to restart gitd)`,
            downloading: `Downloading gitdeck ${update.version}`,
          }[update.kind],
          tone: update.kind === 'downloading' ? 'busy' : 'good',
          onClick: onSettings,
        }
      : null,
  )
  const gh = prs?.status?.enabled ? prs.status.gh : null
  useStatusItem(
    gh
      ? {
          id: 'github',
          side: 'right',
          order: 10,
          icon: 'pr',
          text: gh.kind === 'ready' ? gh.login : gh.kind === 'missing' ? 'no gh' : gh.kind === 'loggedOut' ? 'gh logged out' : 'gh error',
          title: gh.kind === 'ready' ? `GitHub through gh, as ${gh.login} (click: pull requests)` : 'GitHub is unavailable: run `gh auth login` on the host (click: details)',
          tone: gh.kind === 'ready' ? 'normal' : 'warn',
          onClick: onPulls,
        }
      : null,
  )
}
