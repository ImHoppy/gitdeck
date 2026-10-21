import { type ReactNode, useMemo } from 'react'
import type { PrDetail, Timeline } from '../../protocol/github'
import type { MarkdownLinks } from '../../ui/Markdown/links'
import { MeasuredList } from '../../ui/VirtualList/MeasuredList'
import styles from './Conversation.module.css'
import { type ConversationActions, TimelineEntry } from './TimelineEntry'
import { timelineEntries } from './timelineEntries'

const ESTIMATE = 90

type Props = { detail: PrDetail; timeline: Timeline | null; links: MarkdownLinks; actions: ConversationActions; reply: ReactNode }

/** One virtualized timeline in GitHub's order, the reply box pinned under it. */
export function ConversationTab({ detail, timeline, links, actions, reply }: Props) {
  const entries = useMemo(() => timelineEntries(timeline), [timeline])
  const threadCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of timeline?.threads ?? []) if (t.reviewId) m.set(t.reviewId, (m.get(t.reviewId) ?? 0) + t.comments.length)
    return m
  }, [timeline])
  return (
    <div className={styles.conversation}>
      <div className={styles.timeline}>
        <MeasuredList
          count={entries.length}
          itemKey={(i) => entries[i].key}
          estimate={ESTIMATE}
          renderItem={(i) => (
            <div className={styles.entry}>
              <TimelineEntry entry={entries[i]} detail={detail} timeline={timeline} links={links} actions={actions} threadCount={threadCount} />
            </div>
          )}
        />
      </div>
      <div className={styles.replyBox}>{reply}</div>
    </div>
  )
}
