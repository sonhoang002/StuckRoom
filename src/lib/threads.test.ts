import { describe, expect, it } from 'vitest'
import type { RecordData } from 'deepspace'
import type { Reply } from '@/types'
import { groupReplies } from './threads'

// Builds a reply envelope the way useQuery returns it. Timestamps increase
// with `n` so the list is oldest-first, like the thread page's query.
function reply(recordId: string, replyToId: string | undefined, n: number): RecordData<Reply> {
  const data = { content: `text of ${recordId}`, questionId: 'q_1' } as Reply
  if (replyToId !== undefined) data.replyToId = replyToId
  const at = `2026-11-19T10:00:0${n}.000Z`
  return { recordId, createdBy: 'u_1', createdAt: at, updatedAt: at, data }
}

const ids = (list: RecordData<Reply>[]) => list.map((r) => r.recordId)
const shape = (groups: ReturnType<typeof groupReplies>) =>
  groups.map((g) => ({ id: g.reply.recordId, children: ids(g.children) }))

describe('groupReplies', () => {
  it('returns an empty list for no replies', () => {
    expect(groupReplies([])).toEqual([])
  })

  it('makes each top-level reply its own group, in input order', () => {
    const groups = groupReplies([reply('r1', '', 1), reply('r2', '', 2)])
    expect(shape(groups)).toEqual([
      { id: 'r1', children: [] },
      { id: 'r2', children: [] },
    ])
  })

  it('keeps the whole reply in the group (content and author are needed to render it)', () => {
    const r1 = reply('r1', '', 1)
    const [group] = groupReplies([r1])
    expect(group?.reply).toEqual(r1)
  })

  it('attaches children to their parent, oldest first (the worked example)', () => {
    const groups = groupReplies([
      reply('r1', '', 1),
      reply('r2', '', 2),
      reply('r3', 'r1', 3),
      reply('r4', 'r1', 4),
    ])
    expect(shape(groups)).toEqual([
      { id: 'r1', children: ['r3', 'r4'] },
      { id: 'r2', children: [] },
    ])
  })

  it('treats a missing replyToId (absent, not "") as top-level', () => {
    const groups = groupReplies([reply('r1', undefined, 1)])
    expect(shape(groups)).toEqual([{ id: 'r1', children: [] }])
  })

  it('shows a reply whose parent was deleted as a top-level group (never drops it)', () => {
    const groups = groupReplies([reply('r1', '', 1), reply('r5', 'r9', 2)])
    expect(shape(groups)).toEqual([
      { id: 'r1', children: [] },
      { id: 'r5', children: [] },
    ])
  })

  it('still nests a child that arrives before its parent', () => {
    const groups = groupReplies([reply('r3', 'r1', 1), reply('r1', '', 2)])
    expect(shape(groups)).toEqual([{ id: 'r1', children: ['r3'] }])
  })

  it('never loses or duplicates a reply', () => {
    const input = [
      reply('r1', '', 1),
      reply('r2', 'r1', 2),
      reply('r3', 'gone', 3),
      reply('r4', '', 4),
      reply('r5', 'r4', 5),
    ]
    const groups = groupReplies(input)
    const all = groups.flatMap((g) => [g.reply.recordId, ...ids(g.children)])
    expect(all.sort()).toEqual(ids(input).sort())
  })
})
