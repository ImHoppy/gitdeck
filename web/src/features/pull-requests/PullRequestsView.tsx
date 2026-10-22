import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNarrow } from '../../lib/useNarrow'
import { usePaneSize } from '../../lib/usePaneSize'
import { useSessionState } from '../../lib/useSessionState'
import { gitd } from '../../protocol/client'
import type { ListState, PrOrder, PrQuery, PrSort, RepoMatch } from '../../protocol/github'
import type { WorkspaceSnapshot } from '../../protocol/types'
import { Resizer } from '../../ui/Resizer/Resizer'
import { filterPrs, type Scope } from './filter'
import { PrDetailPane } from './PrDetailPane'
import { refCard, type RefHandlers } from './prLinks'
import { PrList } from './PrList'
import { PrPager } from './PrPager'
import { ALL_REPOS, type PullsPlace } from './prNav'
import { PrToolbar } from './PrToolbar'
import { PrUnavailable } from './PrUnavailable'
import styles from './PullRequests.module.css'
import { CreatePrForm } from './CreatePrForm'
import { LabelFilter } from './LabelFilter'
import { SortMenu } from './SortMenu'
import type { PrAvailability } from './usePrStatus'
import { usePullRequests } from './usePullRequests'
import { useRepoLabels } from './useRepoLabels'

const same = (a: string, b: string) => a.replaceAll('\\', '/').toLowerCase() === b.replaceAll('\\', '/').toLowerCase()

type Props = {
  workspace: WorkspaceSnapshot
  availability: PrAvailability
  place: PullsPlace
  /** A jump worth undoing with Back; `repoPath` also moves the main window to that repo. */
  push: (place: PullsPlace, repoPath?: string) => void
  /** Moving through the list, tabs and filters: no history entry. */
  replace: (place: PullsPlace) => void
  /** The repo shown in the main window, picked when the view has none yet. */
  currentRepoId: number | null
  lead?: ReactNode
  pop?: { title: string; run: () => void }
  onShowInHistory: (repoId: number, rev: string) => void
}

/** The PR list on the left, the whole selected PR on the right, like an email client. */
export function PullRequestsView({ workspace, availability, place, push, replace, currentRepoId, lead, pop, onShowInHistory }: Props) {
  const { repos: links, ready } = availability
  const [state, setState] = useSessionState<ListState>('pulls.state', 'open')
  const [scope, setScope] = useSessionState<Scope>('pulls.scope', 'all')
  const [labels, setLabels] = useSessionState<{ names: string[]; none: boolean }>('pulls.labels', { names: [], none: false })
  const [sorting, setSorting] = useSessionState<{ sort: PrSort; order: PrOrder }>('pulls.sort', { sort: 'updated', order: 'desc' })
  const [labelsWanted, setLabelsWanted] = useState(false)
  const [filter, setFilter] = useState('')
  const listWidth = usePaneSize('pullsList', 380, 220, 900)
  const narrow = useNarrow()
  const detailRef = useRef<HTMLDivElement>(null)

  const pathOf = useCallback((id: number) => workspace.repos.find((r) => r.id === id)?.path ?? null, [workspace])
  const all = place.repo === ALL_REPOS
  const selectedLink = all
    ? null
    : (links.find((l) => place.repo && same(pathOf(l.id) ?? '', place.repo)) ?? links.find((l) => l.id === currentRepoId) ?? links[0] ?? null)
  const listed = useMemo(() => (all ? links : selectedLink ? [selectedLink] : []), [all, links, selectedLink])
  const query: PrQuery = { state, scope, labels: labels.names, noLabel: labels.none, ...sorting }
  const prs = usePullRequests(listed, query, ready)
  const repoLabels = useRepoLabels(listed, labelsWanted)
  const rows = useMemo(() => filterPrs(prs.rows, filter), [prs.rows, filter])

  const prRepo = place.prRepo ?? selectedLink?.repo ?? null
  const prLink = prRepo ? links.find((l) => same(l.repo, prRepo)) : undefined
  const prLocal = prLink ? { id: prLink.id, remote: prLink.remote, repo: workspace.repos.find((r) => r.id === prLink.id) ?? null } : null
  const selectedKey = place.pr && prRepo ? `${prRepo}#${place.pr}` : null

  const handlers: RefHandlers = useMemo(
    () => ({
      onRef: async (repo, number) => {
        const card = await refCard(repo, number)
        if (card && !card.isPull) {
          window.open(`https://github.com/${repo}/issues/${number}`, '_blank', 'noopener,noreferrer')
          return
        }
        const next = { ...place, pr: number, prRepo: repo, tab: 'conversation' as const, create: null }
        const link = links.find((l) => same(l.repo, repo))
        if (link) return push(all ? next : { ...next, repo: pathOf(link.id) }, pathOf(link.id) ?? undefined)
        // another remote of a workspace repo (a fork's upstream), else a PR read through gh -R only
        const matches = await gitd.call<RepoMatch[]>('pr.findRepo', { repo }).catch(() => [] as RepoMatch[])
        const match = matches.find((m) => m.origin) ?? matches[0]
        push(next, match ? (pathOf(match.id) ?? undefined) : undefined)
      },
      onCommit: (repo, sha) => {
        const link = links.find((l) => same(l.repo, repo))
        if (link) onShowInHistory(link.id, sha)
        else window.open(`https://github.com/${repo}/commit/${sha}`, '_blank', 'noopener,noreferrer')
      },
    }),
    [place, links, all, push, pathOf, onShowInHistory],
  )

  const repoOptions: [string, string][] = [
    [ALL_REPOS, 'All repos'],
    ...links.map((l): [string, string] => {
      const r = workspace.repos.find((w) => w.id === l.id)
      return [r?.path ?? String(l.id), `${r?.pathInParent ?? r?.name ?? l.repo} (${l.repo})`]
    }),
  ]
  const selectorValue = all ? ALL_REPOS : selectedLink ? (pathOf(selectedLink.id) ?? ALL_REPOS) : ALL_REPOS
  const currentBranch = (id: number) => {
    const head = workspace.repos.find((r) => r.id === id)?.state?.head
    return head?.kind === 'branch' ? head.name : null
  }

  const { refresh } = prs
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F5') return
      e.preventDefault()
      refresh()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [refresh])

  if (!ready || links.length === 0) return <PrUnavailable availability={availability} lead={lead} />
  const showDetail = !narrow || !!place.pr || !!place.create
  const showList = !narrow || (!place.pr && !place.create)
  return (
    <div className={styles.view}>
      <PrToolbar
        lead={lead}
        repos={repoOptions}
        repo={selectorValue}
        onRepo={(repo) => push({ ...place, repo, pr: null, prRepo: null, create: null })}
        state={state}
        onState={setState}
        scope={scope}
        onScope={setScope}
        filters={
          <>
            <LabelFilter
              labels={repoLabels}
              selected={labels.names}
              noLabel={labels.none}
              onChange={(names, none) => setLabels({ names, none })}
              onOpen={() => setLabelsWanted(true)}
            />
            <SortMenu sort={sorting.sort} order={sorting.order} onChange={(sort, order) => setSorting({ sort, order })} />
          </>
        }
        filter={filter}
        onFilter={setFilter}
        loading={prs.loading}
        onRefresh={prs.refresh}
        onNew={selectedLink ? () => push({ ...place, pr: null, create: currentBranch(selectedLink.id) ?? '' }) : null}
        pop={pop}
      />
      {prs.error && <div className={styles.error}>{prs.error}</div>}
      <div className={styles.body}>
        {showList && (
          <div className={narrow ? `${styles.listPane} ${styles.listFull}` : styles.listPane} style={narrow ? undefined : { width: listWidth.size }}>
            <PrList
              rows={rows}
              unread={prs.unread}
              selected={selectedKey}
              showRepo={all}
              empty={prs.loading ? 'Loading…' : `No ${state} pull requests${scope !== 'all' || filter || labels.names.length || labels.none ? ' here' : ''}.`}
              checkedOut={(pr) => !pr.isCrossRepository && pr.repoId !== null && currentBranch(pr.repoId) === pr.headRefName}
              onSelect={(pr, move) => (move ? replace : push)({ ...place, pr: pr.number, prRepo: pr.repo, create: null })}
              key={prs.page}
              onEnter={() => detailRef.current?.focus()}
            />
            <PrPager page={prs.page} pages={prs.pages} hasNext={prs.hasNext} loading={prs.loading} onPage={prs.goTo} />
          </div>
        )}
        {!narrow && <Resizer axis="x" onDrag={listWidth.drag} onDone={listWidth.save} />}
        {showDetail && (
          <div className={styles.detailPane} ref={detailRef} tabIndex={-1}>
            {place.create !== null && selectedLink ? (
              <CreatePrForm
                key={`${selectedLink.id}:${place.create}`}
                repoId={selectedLink.id}
                repo={selectedLink.repo}
                head={place.create}
                headIsCurrent={currentBranch(selectedLink.id) === place.create}
                handlers={handlers}
                onCreated={(number) => push({ ...place, create: null, pr: number, prRepo: selectedLink.repo })}
                onCancel={() => push({ ...place, create: null })}
              />
            ) : place.pr && prRepo ? (
              <PrDetailPane
                key={selectedKey}
                target={{ id: prLink?.id ?? null, repo: prRepo }}
                number={place.pr}
                tab={place.tab}
                onTab={(tab) => replace({ ...place, tab })}
                local={prLocal}
                handlers={handlers}
                onShowInHistory={onShowInHistory}
                onBack={narrow ? () => push({ ...place, pr: null }) : undefined}
              />
            ) : (
              <div className={styles.emptyList}>{rows.length ? 'Pick a pull request.' : ''}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
