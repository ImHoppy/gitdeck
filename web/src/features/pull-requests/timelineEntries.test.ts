import { expect, test } from 'bun:test'
import type { Comment, ReviewThread, Timeline } from '../../protocol/github'
import { threadsAt, timelineEntries } from './timelineEntries'

const comment = (id: string): Comment => ({ id, author: 'a', body: 'b', createdAt: 't', updatedAt: 't', canEdit: false, canDelete: false, reactions: [] })

const thread = (id: string, reviewId: string | null, line = 3): ReviewThread => ({
  id,
  resolved: false,
  outdated: false,
  path: 'a.rs',
  line,
  originalLine: line,
  startLine: null,
  side: 'RIGHT',
  canResolve: true,
  canUnresolve: false,
  canReply: true,
  reviewId,
  diffHunk: '@@',
  comments: [comment(`${id}c`)],
})

test('threads follow the review they were opened in', () => {
  const timeline: Timeline = {
    viewer: 'me',
    prId: 'PR_1',
    viewerCanUpdate: true,
    items: [
      { kind: 'comment', ...comment('IC_1') },
      { kind: 'review', state: 'COMMENTED', ...comment('PRR_1') },
      { kind: 'commit', oid: 'abc', headline: 'h', author: 'a', at: 't' },
    ],
    threads: [thread('T2', 'PRR_gone'), thread('T1', 'PRR_1')],
  }
  expect(timelineEntries(timeline).map((e) => e.key)).toEqual(['description', 'IC_1', 'PRR_1', 'T1', 'c:abc', 'T2'])
  expect(timelineEntries(null).map((e) => e.kind)).toEqual(['description'])
})

test('threads by file line', () => {
  const at = threadsAt([thread('T1', null, 3), thread('T2', null, 3), { ...thread('T3', null, 9), path: 'b.rs' }], 'a.rs')
  expect([...at.keys()]).toEqual(['RIGHT:3'])
  expect(at.get('RIGHT:3')).toHaveLength(2)
})
