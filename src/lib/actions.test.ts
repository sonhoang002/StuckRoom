import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The browser helper must not need a real login or server in tests:
// getAuthToken and fetch are both replaced with fakes.
vi.mock('deepspace', () => ({ getAuthToken: vi.fn() }))

import { getAuthToken } from 'deepspace'
import { callAction } from './actions'

const mockedToken = vi.mocked(getAuthToken)
const fetchMock = vi.fn()

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  mockedToken.mockReset()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('callAction', () => {
  it('refuses without a request when the user is signed out', async () => {
    mockedToken.mockResolvedValue(null)
    const result = await callAction('postReply', { questionId: 'q_1' })
    expect(result.success).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('POSTs JSON params with the bearer token to /api/actions/<name>', async () => {
    mockedToken.mockResolvedValue('tok_123')
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: { recordId: 'r_1' } }))

    await callAction('postReply', { questionId: 'q_1', content: 'hi' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/actions/postReply')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer tok_123',
    })
    expect(JSON.parse(init.body as string)).toEqual({ questionId: 'q_1', content: 'hi' })
  })

  it("returns the action's success result unchanged", async () => {
    mockedToken.mockResolvedValue('tok')
    const body = { success: true, data: { recordId: 'r_1' } }
    fetchMock.mockResolvedValue(jsonResponse(body))
    expect(await callAction('postReply', {})).toEqual(body)
  })

  it("returns the action's own failure (e.g. not the owner) unchanged", async () => {
    mockedToken.mockResolvedValue('tok')
    const body = { success: false, error: "Only the question's owner can mark it solved" }
    fetchMock.mockResolvedValue(jsonResponse(body))
    expect(await callAction('markSolved', {})).toEqual(body)
  })

  it.each([401, 404, 500])('turns an HTTP %i into a failure result', async (status) => {
    mockedToken.mockResolvedValue('tok')
    fetchMock.mockResolvedValue(jsonResponse({ error: 'nope' }, status))
    const result = await callAction('postReply', {})
    expect(result.success).toBe(false)
    expect(typeof result.error).toBe('string')
  })

  it('turns a network failure (fetch throws) into a failure result', async () => {
    mockedToken.mockResolvedValue('tok')
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await callAction('postReply', {})
    expect(result.success).toBe(false)
    expect(typeof result.error).toBe('string')
  })

  it('turns a non-JSON 200 response into a failure result', async () => {
    mockedToken.mockResolvedValue('tok')
    fetchMock.mockResolvedValue(new Response('<html>oops</html>', { status: 200 }))
    const result = await callAction('postReply', {})
    expect(result.success).toBe(false)
  })

  // `data as ActionResult` is a type assertion, not a check: JSON that is not
  // an ActionResult would otherwise reach the UI typed as one.
  it('turns JSON that is not an ActionResult into a failure result', async () => {
    mockedToken.mockResolvedValue('tok')
    fetchMock.mockResolvedValue(jsonResponse({ hello: 'world' }))
    const result = await callAction('postReply', {})
    expect(result.success).toBe(false)
  })
})
