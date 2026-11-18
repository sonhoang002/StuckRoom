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
    data: { title: 't', content: 'c', status: 'active', visibility: 'public' },
  }
}

// Builds a fake ctx so the handler runs without a server. Only the parts
// markSolved uses (params, userId, tools.get, tools.update) are real.
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

function markSolved(ctx: ActionContext<Env>) {
  const handler = actions.markSolved
  if (!handler) throw new Error('markSolved is not registered in the `actions` object')
  return handler(ctx)
}

describe('markSolved', () => {
  it('is registered, so POST /api/actions/markSolved exists', () => {
    expect(typeof actions.markSolved).toBe('function')
  })

  it.each([
    ['missing', {}],
    ['empty string', { questionId: '' }],
    ['not a string', { questionId: 123 }],
  ])('rejects a %s questionId without touching the database', async (_label, params) => {
    const { ctx, get, update } = makeCtx({ params })
    const result = await markSolved(ctx)
    expect(result.success).toBe(false)
    expect(get).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('passes through a failed lookup (e.g. question not found) and does not update', async () => {
    const notFound = { success: false as const, error: 'Record not found', code: 'not_found' }
    const { ctx, update } = makeCtx({ params: { questionId: QID }, getResult: notFound })
    const result = await markSolved(ctx)
    expect(result).toEqual(notFound)
    expect(update).not.toHaveBeenCalled()
  })

  it("refuses when the caller does not own the question", async () => {
    const { ctx, update } = makeCtx({ params: { questionId: QID }, userId: OTHER })
    const result = await markSolved(ctx)
    expect(result.success).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })

  it('lets the owner mark it solved: status solved, still public, lastActiveDate untouched', async () => {
    const { ctx, get, update } = makeCtx({ params: { questionId: QID } })
    const result = await markSolved(ctx)
    expect(get).toHaveBeenCalledWith('question', QID)
    expect(update).toHaveBeenCalledWith('question', QID, { status: 'solved', visibility: 'public' })
    expect(result.success).toBe(true)
  })

  it('reports failure if the update itself fails', async () => {
    const failed = { success: false as const, error: 'write rejected' }
    const { ctx } = makeCtx({ params: { questionId: QID }, updateResult: failed })
    const result = await markSolved(ctx)
    expect(result.success).toBe(false)
  })
})
