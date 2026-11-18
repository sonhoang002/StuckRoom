import { describe, expect, it, vi } from 'vitest'
import type { ActionContext, ActionResult } from 'deepspace/worker'
import type { Env } from '../../worker'
import { actions } from './index'

const OWNER = 'user_owner'
const OTHER = 'user_other'
const QID = 'q_123'

function questionRecord(createdBy: string) {
  return {
    recordId: QID,
    createdBy,
    createdAt: '2026-11-10T00:00:00Z',
    updatedAt: '2026-11-10T00:00:00Z',
    data: { title: 't', content: 'c', status: 'solved', visibility: 'public' },
  }
}

// Builds a fake ctx so a handler runs without a server. Only the parts the
// question actions use (params, userId, tools.get, tools.update) are real.
function makeCtx(opts: {
  params: Record<string, unknown>
  userId?: string
  getResult?: ActionResult
  updateResult?: ActionResult
}) {
  const get = vi.fn(async () =>
    opts.getResult ?? { success: true as const, data: { record: questionRecord(OWNER) } },
  )
  const update = vi.fn(async () =>
    opts.updateResult ?? { success: true as const, data: { recordId: QID } },
  )
  const ctx = {
    userId: opts.userId ?? OWNER,
    params: opts.params,
    tools: { get, update },
    env: {},
    callerJwt: 'jwt',
  } as unknown as ActionContext<Env>
  return { ctx, get, update }
}

function run(name: string, ctx: ActionContext<Env>) {
  const handler = actions[name]
  if (!handler) throw new Error(`${name} is not registered in the \`actions\` object`)
  return handler(ctx)
}

// Rules every owner-only question action must follow.
describe.each(['markSolved', 'reopen'])('%s (owner-only question action)', (name) => {
  it(`is registered, so POST /api/actions/${name} exists`, () => {
    expect(typeof actions[name]).toBe('function')
  })

  it.each([
    ['missing', {}],
    ['empty string', { questionId: '' }],
    ['not a string', { questionId: 123 }],
  ])('rejects a %s questionId without touching the database', async (_label, params) => {
    const { ctx, get, update } = makeCtx({ params })
    const result = await run(name, ctx)
    expect(result.success).toBe(false)
    expect(get).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('passes through a failed lookup (e.g. question not found) and does not update', async () => {
    const notFound = { success: false as const, error: 'Record not found', code: 'not_found' }
    const { ctx, update } = makeCtx({ params: { questionId: QID }, getResult: notFound })
    const result = await run(name, ctx)
    expect(result).toEqual(notFound)
    expect(update).not.toHaveBeenCalled()
  })

  it('refuses when the caller does not own the question', async () => {
    const { ctx, update } = makeCtx({ params: { questionId: QID }, userId: OTHER })
    const result = await run(name, ctx)
    expect(result.success).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })

  it('reports failure if the update itself fails', async () => {
    const failed = { success: false as const, error: 'write rejected' }
    const { ctx } = makeCtx({ params: { questionId: QID }, updateResult: failed })
    const result = await run(name, ctx)
    expect(result.success).toBe(false)
  })
})

describe('markSolved', () => {
  it('lets the owner mark it solved: status solved, still public, lastActiveDate untouched', async () => {
    const { ctx, get, update } = makeCtx({ params: { questionId: QID } })
    const result = await run('markSolved', ctx)
    expect(get).toHaveBeenCalledWith('question', QID)
    expect(update).toHaveBeenCalledWith('question', QID, { status: 'solved', visibility: 'public' })
    expect(result.success).toBe(true)
  })
})

describe('reopen', () => {
  it('lets the owner reopen: status active and public', async () => {
    const { ctx, update } = makeCtx({ params: { questionId: QID } })
    const result = await run('reopen', ctx)
    expect(update).toHaveBeenCalledWith(
      'question',
      QID,
      expect.objectContaining({ status: 'active', visibility: 'public' }),
    )
    expect(result.success).toBe(true)
  })

  it('restarts the 7-day clock: sets lastActiveDate to now as an ISO string (reopen)', async () => {
    const now = new Date('2026-11-18T15:00:00.000Z')
    vi.useFakeTimers({ now })
    try {
      const { ctx, update } = makeCtx({ params: { questionId: QID } })
      await run('reopen', ctx)
      expect(update).toHaveBeenCalledWith(
        'question',
        QID,
        expect.objectContaining({ lastActiveDate: now.toISOString() }),
      )
    } finally {
      vi.useRealTimers()
    }
  })
})

// ---------------------------------------------------------------------------
// postReply
// ---------------------------------------------------------------------------

type Row = { recordId: string; createdBy: string; data: Record<string, unknown> }

// A tiny fake record store keyed by "collection/recordId", so tools.get can
// return different rows for the question and the parent reply.
function makeReplyCtx(opts: {
  params: Record<string, unknown>
  userId?: string
  rows?: Row[]
  createResult?: ActionResult
  updateResult?: ActionResult
}) {
  const store = new Map<string, Row>()
  for (const row of opts.rows ?? []) {
    const collection = row.recordId.startsWith('q_') ? 'question' : 'reply'
    store.set(`${collection}/${row.recordId}`, row)
  }
  const get = vi.fn(async (collection: string, recordId: string) => {
    const row = store.get(`${collection}/${recordId}`)
    if (!row) return { success: false as const, error: 'Record not found', code: 'not_found' }
    return {
      success: true as const,
      data: { record: { ...row, createdAt: '2026-11-10T00:00:00Z', updatedAt: '2026-11-10T00:00:00Z' } },
    }
  })
  const create = vi.fn(async () =>
    opts.createResult ?? { success: true as const, data: { recordId: 'r_new' } },
  )
  const update = vi.fn(async () =>
    opts.updateResult ?? { success: true as const, data: { recordId: QID } },
  )
  const ctx = {
    userId: opts.userId ?? OTHER,
    params: opts.params,
    tools: { get, create, update },
    env: {},
    callerJwt: 'jwt',
  } as unknown as ActionContext<Env>
  return { ctx, get, create, update }
}

function question(overrides: Partial<{ status: string; visibility: string }> = {}): Row {
  return {
    recordId: QID,
    createdBy: OWNER,
    data: { title: 't', content: 'c', status: 'active', visibility: 'public', ...overrides },
  }
}

const TOP_LEVEL: Row = {
  recordId: 'r_top',
  createdBy: OTHER,
  data: { content: 'top', questionId: QID, replyToId: '' },
}

describe('postReply', () => {
  it('is registered, so POST /api/actions/postReply exists', () => {
    expect(typeof actions.postReply).toBe('function')
  })

  describe('validation (nothing is read or written on bad input)', () => {
    it.each([
      ['missing questionId', { content: 'hi' }],
      ['empty questionId', { questionId: '', content: 'hi' }],
      ['missing content', { questionId: QID }],
      ['whitespace-only content', { questionId: QID, content: '   ' }],
      ['non-string content', { questionId: QID, content: 42 }],
      ['empty replyToId', { questionId: QID, content: 'hi', replyToId: '' }],
      ['non-string replyToId', { questionId: QID, content: 'hi', replyToId: 7 }],
    ])('rejects %s', async (_label, params) => {
      const { ctx, get, create } = makeReplyCtx({ params, rows: [question()] })
      const result = await run('postReply', ctx)
      expect(result.success).toBe(false)
      expect(get).not.toHaveBeenCalled()
      expect(create).not.toHaveBeenCalled()
    })
  })

  describe('question checks', () => {
    it('passes through "question not found" and creates nothing', async () => {
      const { ctx, create } = makeReplyCtx({ params: { questionId: QID, content: 'hi' }, rows: [] })
      const result = await run('postReply', ctx)
      expect(result.success).toBe(false)
      expect(create).not.toHaveBeenCalled()
    })

    it('refuses a non-owner replying to a private question (tools.get ignores read rules)', async () => {
      const { ctx, create } = makeReplyCtx({
        params: { questionId: QID, content: 'hi' },
        userId: OTHER,
        rows: [question({ status: 'inactive', visibility: 'private' })],
      })
      const result = await run('postReply', ctx)
      expect(result.success).toBe(false)
      expect(create).not.toHaveBeenCalled()
    })
  })

  describe('replying to a comment (one level of nesting)', () => {
    it('fails when the parent reply does not exist', async () => {
      const { ctx, create } = makeReplyCtx({
        params: { questionId: QID, content: 'hi', replyToId: 'r_missing' },
        rows: [question()],
      })
      const result = await run('postReply', ctx)
      expect(result.success).toBe(false)
      expect(create).not.toHaveBeenCalled()
    })

    it('refuses a parent that belongs to a different question', async () => {
      const elsewhere: Row = { ...TOP_LEVEL, recordId: 'r_else', data: { ...TOP_LEVEL.data, questionId: 'q_other' } }
      const { ctx, create } = makeReplyCtx({
        params: { questionId: QID, content: 'hi', replyToId: 'r_else' },
        rows: [question(), elsewhere],
      })
      const result = await run('postReply', ctx)
      expect(result.success).toBe(false)
      expect(create).not.toHaveBeenCalled()
    })

    it('refuses replying to a reply that is itself nested', async () => {
      const nested: Row = { ...TOP_LEVEL, recordId: 'r_nested', data: { ...TOP_LEVEL.data, replyToId: 'r_top' } }
      const { ctx, create } = makeReplyCtx({
        params: { questionId: QID, content: 'hi', replyToId: 'r_nested' },
        rows: [question(), TOP_LEVEL, nested],
      })
      const result = await run('postReply', ctx)
      expect(result.success).toBe(false)
      expect(create).not.toHaveBeenCalled()
    })

    it('creates a reply to a top-level comment with the values from params', async () => {
      const { ctx, create } = makeReplyCtx({
        params: { questionId: QID, content: 'new text', replyToId: 'r_top' },
        rows: [question(), TOP_LEVEL],
      })
      const result = await run('postReply', ctx)
      expect(create).toHaveBeenCalledWith('reply', { content: 'new text', questionId: QID, replyToId: 'r_top' })
      expect(result.success).toBe(true)
    })

    // Unverified platform detail: an empty optional column may come back as
    // "" or be absent. Either way the parent is top-level.
    it('treats a parent with no stored replyToId as top-level', async () => {
      const noField: Row = { recordId: 'r_nofield', createdBy: OTHER, data: { content: 'top', questionId: QID } }
      const { ctx, create } = makeReplyCtx({
        params: { questionId: QID, content: 'hi', replyToId: 'r_nofield' },
        rows: [question(), noField],
      })
      const result = await run('postReply', ctx)
      expect(result.success).toBe(true)
      expect(create).toHaveBeenCalled()
    })
  })

  describe('creating a top-level reply', () => {
    it('creates it from params and returns the create result (new recordId)', async () => {
      const { ctx, create } = makeReplyCtx({ params: { questionId: QID, content: 'hi' }, rows: [question()] })
      const result = await run('postReply', ctx)
      expect(create).toHaveBeenCalledWith('reply', expect.objectContaining({ content: 'hi', questionId: QID }))
      const data = (create.mock.calls[0] as unknown[])[1] as Record<string, unknown>
      expect(data.replyToId || undefined).toBeUndefined()
      expect(result).toEqual({ success: true, data: { recordId: 'r_new' } })
    })

    it('passes through a failed create and does not touch the question', async () => {
      const failed = { success: false as const, error: 'write rejected' }
      const { ctx, update } = makeReplyCtx({
        params: { questionId: QID, content: 'hi' },
        userId: OWNER,
        rows: [question()],
        createResult: failed,
      })
      const result = await run('postReply', ctx)
      expect(result).toEqual(failed)
      expect(update).not.toHaveBeenCalled()
    })
  })

  describe("the owner's 7-day clock", () => {
    it('does NOT update the question when someone else replies', async () => {
      const { ctx, update } = makeReplyCtx({
        params: { questionId: QID, content: 'hi' },
        userId: OTHER,
        rows: [question()],
      })
      await run('postReply', ctx)
      expect(update).not.toHaveBeenCalled()
    })

    it.each(['active', 'inactive'])(
      'owner reply on an %s question: active, public, lastActiveDate = now',
      async (status) => {
        const now = new Date('2026-11-18T15:00:00.000Z')
        vi.useFakeTimers({ now })
        try {
          const visibility = status === 'inactive' ? 'private' : 'public'
          const { ctx, update } = makeReplyCtx({
            params: { questionId: QID, content: 'hi' },
            userId: OWNER,
            rows: [question({ status, visibility })],
          })
          const result = await run('postReply', ctx)
          expect(result.success).toBe(true)
          expect(update).toHaveBeenCalledWith('question', QID, {
            status: 'active',
            visibility: 'public',
            lastActiveDate: now.toISOString(),
          })
        } finally {
          vi.useRealTimers()
        }
      },
    )

    it('still reports success when only the clock update fails (avoids duplicate retries), and logs it', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        const { ctx, create } = makeReplyCtx({
          params: { questionId: QID, content: 'hi' },
          userId: OWNER,
          rows: [question()],
          updateResult: { success: false, error: 'update failed' },
        })
        const result = await run('postReply', ctx)
        expect(create).toHaveBeenCalledTimes(1)
        expect(result).toEqual({ success: true, data: { recordId: 'r_new' } })
        expect(errorSpy).toHaveBeenCalled()
      } finally {
        errorSpy.mockRestore()
      }
    })

    it('owner reply on a solved question leaves it solved (reopen is explicit)', async () => {
      const { ctx, update, create } = makeReplyCtx({
        params: { questionId: QID, content: 'hi' },
        userId: OWNER,
        rows: [question({ status: 'solved' })],
      })
      const result = await run('postReply', ctx)
      expect(create).toHaveBeenCalled()
      expect(update).not.toHaveBeenCalled()
      expect(result.success).toBe(true)
    })
  })
})
