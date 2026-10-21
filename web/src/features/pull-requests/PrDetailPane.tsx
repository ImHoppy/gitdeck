import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSessionState } from '../../lib/useSessionState'
import { gitd } from '../../protocol/client'
import type { DraftThread, Mutation, RepoInfo, ReviewEvent } from '../../protocol/github'
import { useDialogs } from '../../ui/Dialog/useDialogs'
import { Menu, type MenuItem } from '../../ui/Menu/Menu'
import { Spinner } from '../../ui/Spinner/Spinner'
import { Toast } from '../../ui/Toast/Toast'
import { InteractiveRebaseDialog } from '../rebase'
import { ChecksTab } from './ChecksTab'
import { CommitsTab } from './CommitsTab'
import { ConversationTab } from './ConversationTab'
import styles from './Conversation.module.css'
import { EditPrDialog } from './EditPrDialog'
import { FilesTab } from './FilesTab'
import { mergeBlocked } from './mergeBlocked'
import { MergeDialog } from './MergeDialog'
import { PrHeader } from './PrHeader'
import { prLinks, type RefHandlers } from './prLinks'
import { moreMenu, rebaseMenu } from './prMenus'
import type { PullsTab } from './prNav'
import { ReplyBox } from './ReplyBox'
import type { ConversationActions } from './TimelineEntry'
import { type LocalRepo, useBranchOps } from './useBranchOps'
import { useDraft } from './useDraft'
import { usePendingReview } from './usePendingReview'
import { usePrActions } from './usePrActions'
import { type PrTarget, useChecks, usePrFetch, usePullRequest } from './usePullRequest'

type Props = {
  target: PrTarget
  number: number
  tab: PullsTab
  onTab: (t: PullsTab) => void
  /** The workspace clone of the PR's repo; null for a PR outside the workspace. */
  local: LocalRepo | null
  handlers: RefHandlers
  onShowInHistory: (repoId: number, rev: string) => void
  onBack?: () => void
}

export function PrDetailPane({ target, number, tab, onTab, local, handlers, onShowInHistory, onBack }: Props) {
  const { detail, timeline, error, reload } = usePullRequest(target, number)
  const checks = useChecks(target, number, tab === 'checks')
  const actions = usePrActions(target, number, reload)
  const dialogs = useDialogs()
  const key = `${target.repo.toLowerCase()}#${number}`
  const review = usePendingReview(key)
  const draft = useDraft()
  const [text, setText] = useSessionState(`pr.reply.${key}`, '')
  const [menu, setMenu] = useState<{ items: MenuItem[]; at: { x: number; y: number } } | null>(null)
  const [dialog, setDialog] = useState<'merge' | 'edit' | null>(null)
  const [info, setInfo] = useState<RepoInfo | null>(null)
  const [rebaseFrom, setRebaseFrom] = useState(false)
  const [filesPath, setFilesPath] = useState<string | null>(null)
  const ops = useBranchOps({ local, detail, confirm: dialogs.confirm, report: actions.report, onSwitched: (branch) => local && onShowInHistory(local.id, branch) })
  const fetched = usePrFetch(local?.id ?? null, detail, tab === 'files' || tab === 'commits' || rebaseFrom)
  const links = useMemo(() => prLinks(target.repo, detail?.headRefOid, handlers, draft.id), [target.repo, detail?.headRefOid, handlers, draft.id])

  useEffect(() => {
    if (dialog !== 'merge' || info) return
    gitd.call<RepoInfo>('pr.repoInfo', { ...(local ? { id: local.id } : {}), repo: target.repo }).then(setInfo, () => {})
  }, [dialog, info, local, target.repo])

  useEffect(() => {
    if (!local || !ops.button) return
    const run = ops.button.disabled ? null : ops.button.run
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's' && run) {
        e.preventDefault()
        run()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [local, ops.button])

  const mutate = useCallback((label: string, m: Mutation) => actions.mutate(label, m), [actions])
  const openCommit = (sha: string) => (local ? onShowInHistory(local.id, sha) : window.open(`https://github.com/${target.repo}/commit/${sha}`, '_blank', 'noopener,noreferrer'))
  const convo: ConversationActions & { commentNow: (t: DraftThread) => Promise<boolean> } = {
    editDescription: (body) => (detail ? actions.edit(detail.title, body, draft.id) : Promise.resolve(false)),
    editComment: (id, body) => mutate('Edit comment', { kind: 'edit', id, body }),
    deleteComment: (id) => {
      void dialogs.confirm('Delete the comment?', 'It is removed from GitHub for everyone.', 'Delete').then((ok) => ok && mutate('Delete comment', { kind: 'delete', id }))
    },
    reply: (threadId, body) => mutate('Reply', { kind: 'reply', threadId, body }),
    resolve: (threadId, resolve) => void mutate(resolve ? 'Resolve' : 'Unresolve', resolve ? { kind: 'resolve', threadId } : { kind: 'unresolve', threadId }),
    openFile: (path) => {
      setFilesPath(path)
      onTab('files')
    },
    openCommit,
    commentNow: (t) => (timeline ? mutate('Comment', { kind: 'review', prId: timeline.prId, event: 'COMMENT', body: '', threads: [t] }) : Promise.resolve(false)),
  }

  const sendComment = async () => {
    if (await actions.comment(text, draft.id)) {
      setText('')
      draft.reset()
    }
  }
  const sendReview = async (event: ReviewEvent) => {
    if (!timeline) return
    const label = event === 'APPROVE' ? 'Approve' : event === 'REQUEST_CHANGES' ? 'Request changes' : 'Review'
    if (await mutate(label, { kind: 'review', prId: timeline.prId, event, body: text, threads: review.pending })) {
      setText('')
      review.clear()
    }
  }

  if (error && !detail) return <div className={styles.empty}>{error}</div>
  if (!detail) return <div className={styles.empty}><Spinner /></div>
  const blocked = mergeBlocked(detail)
  const canUpdate = !!timeline?.viewerCanUpdate
  const diffTarget = fetched?.value?.mergeBase ? { kind: 'commit' as const, sha: fetched.value.head, parent: fetched.value.mergeBase } : null
  return (
    <div className={styles.detail}>
      <PrHeader
        detail={detail}
        outside={!local}
        onBack={onBack}
        switchButton={ops.button}
        rebaseMenu={rebaseMenu(detail, {
          checkedOut: ops.checkedOut,
          local: !!local,
          remote: local?.remote ?? null,
          rebaseOntoBase: () => void ops.rebaseOntoBase(),
          interactive: () => setRebaseFrom(true),
          pushRebased: () => void ops.pushRebased(),
          updateOnGithub: () => void actions.setState('Update branch', 'updateBranch'),
        })}
        merge={detail.state === 'OPEN' ? { disabled: !canUpdate, title: blocked ? `Can't merge yet: ${blocked}` : 'Rebase or squash and merge on GitHub', run: () => setDialog('merge') } : null}
        moreMenu={moreMenu(detail, { canUpdate, setState: (label, change) => void actions.setState(label, change), edit: () => setDialog('edit'), refresh: reload })}
        onMenu={(items, at) => setMenu({ items, at })}
        tab={tab}
        onTab={onTab}
        busy={actions.busy || ops.busy ? <Spinner /> : null}
      />
      <div className={styles.tabBody}>
        {tab === 'conversation' && (
          <ConversationTab
            detail={detail}
            timeline={timeline}
            links={links}
            actions={convo}
            reply={
              <ReplyBox
                value={text}
                onChange={setText}
                links={links}
                onAttach={draft.upload}
                pending={review.pending.length}
                busy={!!actions.busy}
                canReview={!!timeline && detail.state === 'OPEN'}
                onComment={() => void sendComment()}
                onReview={(e) => void sendReview(e)}
              />
            }
          />
        )}
        {tab === 'commits' && <CommitsTab detail={detail} onOpen={local && fetched?.value ? openCommit : null} />}
        {tab === 'checks' && <ChecksTab checks={checks.checks} error={checks.error} onReload={checks.reload} />}
        {tab === 'files' &&
          (!local ? (
            <div className={styles.empty}>The diff needs a clone of {target.repo} in the workspace. {detail.files.length} files changed, see GitHub.</div>
          ) : fetched?.error ? (
            <div className={styles.empty}>{fetched.error}</div>
          ) : fetched?.value && !fetched.value.mergeBase ? (
            <div className={styles.empty}>The PR head shares no history with {detail.baseRefName}.</div>
          ) : diffTarget ? (
            <FilesTab repoId={local.id} detail={detail} target={diffTarget} threads={timeline?.threads ?? []} review={review} links={links} actions={convo} initialPath={filesPath} />
          ) : (
            <div className={styles.empty}><Spinner /> fetching the PR head…</div>
          ))}
      </div>
      {menu && <Menu items={menu.items} at={menu.at} onClose={() => setMenu(null)} />}
      {dialog === 'merge' && (
        <MergeDialog
          detail={detail}
          info={info}
          localBranch={local && !ops.checkedOut ? detail.headRefName : null}
          onCancel={() => setDialog(null)}
          onMerge={(method, del, message) => {
            setDialog(null)
            void actions.merge(method, detail.headRefOid, del ? detail.headRefName : null, del && !ops.checkedOut && local ? detail.headRefName : null, message)
          }}
        />
      )}
      {dialog === 'edit' && (
        <EditPrDialog
          title={detail.title}
          body={detail.body}
          links={links}
          onAttach={draft.upload}
          onCancel={() => setDialog(null)}
          onSave={async (title, body) => {
            const ok = await actions.edit(title, body, draft.id)
            if (ok) {
              setDialog(null)
              draft.reset()
            }
            return ok
          }}
        />
      )}
      {rebaseFrom && local && fetched?.value?.mergeBase && (
        <InteractiveRebaseDialog repoId={local.id} base={fetched.value.mergeBase} onClose={() => setRebaseFrom(false)} />
      )}
      {ops.dialog}
      {dialogs.element}
      {actions.result && <Toast tone={actions.result.ok ? 'ok' : 'bad'} title={actions.result.text} onDismiss={actions.clear} autoHide={actions.result.ok ? 5000 : undefined} />}
    </div>
  )
}
