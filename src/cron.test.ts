import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../worker'

// Replace the real cron context (which talks to a Durable Object) with a
// fake whose query/update we control. Only buildCronContext is used by cron.ts.
const query = vi.fn<(collection: string, opts?: unknown) => Promise<unknown[]>>()
const update = vi.fn<(collection: string, id: string, data: unknown) => Promise<unknown>>()
const buildCronContext = vi.fn(() => ({ records: { query, update } }))

vi.mock('deepspace/worker', () => ({ buildCronContext }))

const { runTask, tasks } = await import('./cron')

const NOW = new Date('2026-11-20T12:00:00.000Z')
const OLD = '2026-11-01T00:00:00.000Z' // 19+ days before NOW
const RECENT = '2026-11-19T00:00:00.000Z' // ~1.5 days before NOW

const env = { OWNER_USER_ID: 'owner_1', DEEPSPACE_APP_ID: 'app_1' } as unknown as Env

function row(recordId: string, createdAt: string, data: Record<string, unknown> = {}) {
  return {
    recordId,
    createdBy: 'user_a',
    createdAt,
    updatedAt: createdAt,
    data: { title: 't', content: 'c', status: 'active', visibility: 'public', ...data },
  }
}

const INACTIVE_PATCH = { status: 'inactive', visibility: 'private' }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  query.mockReset()
  update.mockReset()
  buildCronContext.mockClear()
  update.mockResolvedValue({})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('tasks', () => {
  it('registers mark-inactive hourly', () => {
    expect(tasks).toEqual([{ name: 'mark-inactive', intervalMinutes: 60 }])
  })
})

describe('runTask("mark-inactive")', () => {
  it('ignores unknown task names without touching records', async () => {
    await runTask('something-else', env)
    expect(buildCronContext).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
  })

  it('builds the context for the app record room as the owner', async () => {
    query.mockResolvedValue([])
    await runTask('mark-inactive', env)
    expect(buildCronContext).toHaveBeenCalledWith(env, 'owner_1', 'app:app_1')
  })

  it('queries only active questions', async () => {
    query.mockResolvedValue([])
    await runTask('mark-inactive', env)
    expect(query).toHaveBeenCalledWith('question', expect.objectContaining({ where: { status: 'active' } }))
  })

  it('marks a question with no owner activity for 7+ days (createdAt) inactive and private', async () => {
    query.mockResolvedValue([row('q_old', OLD)])
    await runTask('mark-inactive', env)
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith('question', 'q_old', INACTIVE_PATCH)
  })

  it('leaves a recently created question alone', async () => {
    query.mockResolvedValue([row('q_new', RECENT)])
    await runTask('mark-inactive', env)
    expect(update).not.toHaveBeenCalled()
  })

  it('uses lastActiveDate over createdAt: old question with recent owner activity stays active', async () => {
    query.mockResolvedValue([row('q_revived', OLD, { lastActiveDate: RECENT })])
    await runTask('mark-inactive', env)
    expect(update).not.toHaveBeenCalled()
  })

  it('uses lastActiveDate over createdAt: stale lastActiveDate marks it inactive', async () => {
    query.mockResolvedValue([row('q_stale', OLD, { lastActiveDate: OLD })])
    await runTask('mark-inactive', env)
    expect(update).toHaveBeenCalledWith('question', 'q_stale', INACTIVE_PATCH)
  })

  it('updates only the stale questions in a mixed batch', async () => {
    query.mockResolvedValue([row('q1', OLD), row('q2', RECENT), row('q3', OLD)])
    await runTask('mark-inactive', env)
    expect(update.mock.calls.map((c) => c[1])).toEqual(['q1', 'q3'])
  })

  it('skips malformed rows without throwing and still processes valid ones', async () => {
    query.mockResolvedValue([
      null,
      'not an object',
      { createdAt: OLD, data: {} }, // no recordId
      { recordId: 42, createdAt: OLD, data: {} }, // recordId not a string
      { recordId: 'q_no_created', data: {} }, // no createdAt
      { recordId: 'q_num_created', createdAt: 123, data: {} },
      { recordId: 'q_null_data', createdAt: OLD, data: null },
      { recordId: 'q_array_data', createdAt: OLD, data: [] },
      row('q_bad_date', 'not a date'),
      row('q_bad_last', OLD, { lastActiveDate: 'garbage' }),
      row('q_num_last', OLD, { lastActiveDate: 12345 }),
      row('q_valid', OLD),
    ])
    await expect(runTask('mark-inactive', env)).resolves.toBeUndefined()
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith('question', 'q_valid', INACTIVE_PATCH)
  })

  // Developer decision (2026-11-20): one failed update must not stop the rest.
  it('keeps processing the remaining questions when one update throws', async () => {
    query.mockResolvedValue([row('q1', OLD), row('q2', OLD), row('q3', OLD)])
    update.mockImplementation(async (_c, id) => {
      if (id === 'q2') throw new Error('RecordRoom tool records.update failed: boom')
      return {}
    })
    await runTask('mark-inactive', env).catch(() => {})
    expect(update.mock.calls.map((c) => c[1])).toEqual(['q1', 'q2', 'q3'])
  })

  // Developer decision (2026-11-20, option B): check every question, then fail
  // the run if any update failed, so cron history shows it instead of only logs.
  it('rejects after processing all questions when any update failed', async () => {
    query.mockResolvedValue([row('q1', OLD), row('q2', OLD), row('q3', OLD)])
    update.mockImplementation(async (_c, id) => {
      if (id === 'q2') throw new Error('RecordRoom tool records.update failed: boom')
      return {}
    })
    await expect(runTask('mark-inactive', env)).rejects.toThrow()
    expect(update).toHaveBeenCalledTimes(3)
  })

  it('resolves when every update succeeds', async () => {
    query.mockResolvedValue([row('q1', OLD), row('q2', OLD)])
    await expect(runTask('mark-inactive', env)).resolves.toBeUndefined()
  })

  it('lets a failed query reject so the cron history records the run as failed', async () => {
    query.mockRejectedValue(new Error('RecordRoom tool records.query failed: down'))
    await expect(runTask('mark-inactive', env)).rejects.toThrow('records.query failed')
    expect(update).not.toHaveBeenCalled()
  })
})
