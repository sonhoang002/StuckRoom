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

  it('restarts the 7-day clock: sets lastActiveDate to now as an ISO string', async () => {
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
