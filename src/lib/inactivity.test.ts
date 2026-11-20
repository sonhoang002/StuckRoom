import { describe, expect, it } from 'vitest'
import { INACTIVE_AFTER_MS, isInactive } from './inactivity'

const NOW = new Date('2026-11-20T00:00:00.000Z')

describe('INACTIVE_AFTER_MS', () => {
  it('is exactly 7 days', () => {
    expect(INACTIVE_AFTER_MS).toBe(604_800_000)
  })
})

describe('isInactive', () => {
  it('is inactive well past 7 days', () => {
    expect(isInactive(new Date('2026-11-01T00:00:00.000Z'), NOW)).toBe(true)
  })

  it('is active after 1 day', () => {
    expect(isInactive(new Date('2026-11-19T00:00:00.000Z'), NOW)).toBe(false)
  })

  it('counts exactly 7 days as inactive (>=)', () => {
    expect(isInactive(new Date('2026-11-13T00:00:00.000Z'), NOW)).toBe(true)
  })

  it('is active 1 ms before the 7-day mark', () => {
    const justUnder = new Date(NOW.getTime() - INACTIVE_AFTER_MS + 1)
    expect(isInactive(justUnder, NOW)).toBe(false)
  })

  it('is active when last activity equals now', () => {
    expect(isInactive(NOW, NOW)).toBe(false)
  })

  it('is active when last activity is in the future (clock skew)', () => {
    expect(isInactive(new Date('2026-11-21T00:00:00.000Z'), NOW)).toBe(false)
  })

  it('is active for an invalid date (NaN comparisons are false)', () => {
    expect(isInactive(new Date('not a date'), NOW)).toBe(false)
  })
})
