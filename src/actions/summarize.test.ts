import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActionContext, ActionResult } from 'deepspace/worker'
import type { Env } from '../../worker'

// The model is mocked: these tests never call the DeepSpace AI proxy or spend credits.
const { generateText, modelFactory, createDeepSpaceAI } = vi.hoisted(() => {
  const modelFactory = vi.fn((id: string) => ({ fakeModel: id }))
  return {
    generateText: vi.fn(),
    modelFactory,
    createDeepSpaceAI: vi.fn(() => modelFactory),
  }
})

vi.mock('ai', () => ({ generateText }))
vi.mock('deepspace/worker', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createDeepSpaceAI,
}))

const { actions } = await import('./index')

const OWNER = 'user_owner'
const OTHER = 'user_other'
const QID = 'q_123'

function question(overrides: Record<string, unknown> = {}) {
  return {
    recordId: QID,
    createdBy: OWNER,
    createdAt: '2026-11-10T00:00:00Z',
    updatedAt: '2026-11-10T00:00:00Z',
    data: { title: 'Loop never ends', content: 'My while loop runs forever.', status: 'solved', visibility: 'public', ...overrides },
  }
}

function replyRecord(n: number) {
  return {
    recordId: `r${n}`,
    createdBy: OTHER,
    createdAt: `2026-11-1${n}T00:00:00Z`,
    updatedAt: `2026-11-1${n}T00:00:00Z`,
    data: { content: `REPLY-${n}`, questionId: QID },
  }
}

function makeCtx(opts: {
  params?: Record<string, unknown>
  userId?: string
  getResult?: ActionResult
  queryResult?: ActionResult
  updateResult?: ActionResult
} = {}) {
  const get = vi.fn(async () => opts.getResult ?? { success: true as const, data: { record: question() } })
  // Newest first, as the action requests with orderDir: 'desc'.
  const query = vi.fn(async () =>
    opts.queryResult ?? { success: true as const, data: { records: [replyRecord(3), replyRecord(2), replyRecord(1)], count: 3 } },
  )
  const update = vi.fn(async () => opts.updateResult ?? { success: true as const, data: { recordId: QID } })
  const env = { marker: 'env' }
  const ctx = {
    userId: opts.userId ?? OWNER,
    params: opts.params ?? { questionId: QID },
    tools: { get, query, update },
    env,
    callerJwt: 'jwt',
  } as unknown as ActionContext<Env>
  return { ctx, get, query, update, env }
}

function run(ctx: ActionContext<Env>) {
  const handler = actions.summarize
  if (!handler) throw new Error('summarize is not registered in the `actions` object')
  return handler(ctx)
}

function promptSent(): string {
  const call = generateText.mock.calls[0]?.[0] as { prompt: string } | undefined
  if (!call) throw new Error('generateText was not called')
  return call.prompt
}

beforeEach(() => {
  generateText.mockReset()
  generateText.mockResolvedValue({ text: '  The loop lacked an increment; adding i++ fixed it.  ' })
  createDeepSpaceAI.mockClear()
  modelFactory.mockClear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('summarize', () => {
  it('is registered, so POST /api/actions/summarize exists', () => {
    expect(typeof actions.summarize).toBe('function')
  })

  describe('validation and permissions (no model call, no write)', () => {
    it.each([
      ['missing', {}],
      ['empty string', { questionId: '' }],
      ['not a string', { questionId: 123 }],
    ])('rejects a %s questionId', async (_label, params) => {
      const { ctx, get, update } = makeCtx({ params })
      const result = await run(ctx)
      expect(result.success).toBe(false)
      expect(get).not.toHaveBeenCalled()
      expect(generateText).not.toHaveBeenCalled()
      expect(update).not.toHaveBeenCalled()
    })

    it('passes through a failed question lookup', async () => {
      const notFound = { success: false as const, error: 'Record not found' }
      const { ctx, update } = makeCtx({ getResult: notFound })
      expect(await run(ctx)).toEqual(notFound)
      expect(generateText).not.toHaveBeenCalled()
      expect(update).not.toHaveBeenCalled()
    })

    it("refuses someone who isn't the owner", async () => {
      const { ctx, update } = makeCtx({ userId: OTHER })
      const result = await run(ctx)
      expect(result.success).toBe(false)
      expect(generateText).not.toHaveBeenCalled()
      expect(update).not.toHaveBeenCalled()
    })

    it.each(['active', 'inactive'])('refuses a %s question (only solved questions are summarized)', async (status) => {
      const { ctx, update } = makeCtx({
        getResult: { success: true as const, data: { record: question({ status }) } },
      })
      const result = await run(ctx)
      expect(result.success).toBe(false)
      expect(generateText).not.toHaveBeenCalled()
      expect(update).not.toHaveBeenCalled()
    })

    it('passes through a failed reply query', async () => {
      const failed = { success: false as const, error: 'query failed' }
      const { ctx, update } = makeCtx({ queryResult: failed })
      expect(await run(ctx)).toEqual(failed)
      expect(generateText).not.toHaveBeenCalled()
      expect(update).not.toHaveBeenCalled()
    })
  })

  describe('happy path', () => {
    it('fetches the newest 50 replies for this question (desc), so the oldest are the ones dropped', async () => {
      const { ctx, query } = makeCtx()
      await run(ctx)
      expect(query).toHaveBeenCalledWith('reply', {
        where: { questionId: QID },
        orderBy: 'createdAt',
        orderDir: 'desc',
        limit: 50,
      })
    })

    it('sends the question and replies to the model oldest-first', async () => {
      const { ctx } = makeCtx()
      await run(ctx)
      const prompt = promptSent()
      expect(prompt).toContain('Loop never ends')
      expect(prompt).toContain('My while loop runs forever.')
      const positions = ['REPLY-1', 'REPLY-2', 'REPLY-3'].map((r) => prompt.indexOf(r))
      expect(positions.every((p) => p >= 0)).toBe(true)
      expect(positions).toEqual([...positions].sort((a, b) => a - b))
    })

    it('uses the DeepSpace AI proxy (no API key in app code) with claude-haiku-5-5 and an output cap', async () => {
      const { ctx, env } = makeCtx()
      await run(ctx)
      expect(createDeepSpaceAI).toHaveBeenCalledWith(env, 'anthropic')
      expect(modelFactory).toHaveBeenCalledWith('claude-haiku-5-5')
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({ model: { fakeModel: 'claude-haiku-5-5' }, maxOutputTokens: 300 }),
      )
    })

    it('saves the trimmed summary and returns the update result', async () => {
      const { ctx, update } = makeCtx()
      const result = await run(ctx)
      expect(update).toHaveBeenCalledWith('question', QID, {
        summary: 'The loop lacked an increment; adding i++ fixed it.',
      })
      expect(result).toEqual({ success: true, data: { recordId: QID } })
    })

    it('writes only the summary (never status or visibility)', async () => {
      const { ctx, update } = makeCtx()
      await run(ctx)
      const call = update.mock.calls[0] as unknown as [string, string, Record<string, unknown>]
      expect(Object.keys(call[2])).toEqual(['summary'])
    })

    it('works for a solved question with no replies', async () => {
      const { ctx, update } = makeCtx({ queryResult: { success: true as const, data: { records: [], count: 0 } } })
      const result = await run(ctx)
      expect(result.success).toBe(true)
      expect(update).toHaveBeenCalledTimes(1)
    })
  })

  describe('model failures (question stays solved; nothing saved)', () => {
    it('returns a friendly error when the model call throws', async () => {
      generateText.mockRejectedValue(new Error('proxy: insufficient credits'))
      const { ctx, update } = makeCtx()
      const result = await run(ctx)
      expect(result).toEqual({ success: false, error: expect.any(String) })
      expect(update).not.toHaveBeenCalled()
    })

    it("doesn't leak the internal error message to the browser", async () => {
      generateText.mockRejectedValue(new Error('proxy: insufficient credits for owner app_123'))
      const { ctx } = makeCtx()
      const result = await run(ctx)
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).not.toContain('app_123')
    })

    it.each(['', '   ', '\n\t'])('rejects an empty model output (%j) instead of saving it', async (text) => {
      generateText.mockResolvedValue({ text })
      const { ctx, update } = makeCtx()
      const result = await run(ctx)
      expect(result.success).toBe(false)
      expect(update).not.toHaveBeenCalled()
    })
  })
})
