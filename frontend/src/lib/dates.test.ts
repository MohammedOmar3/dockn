import { describe, it, expect } from 'vitest'
import { addDays, toDateString, todayString } from './dates'

describe('addDays', () => {
  it('steps back exactly one day per call', () => {
    expect(addDays('2026-09-24', -1)).toBe('2026-09-23')
    expect(addDays('2026-09-23', -1)).toBe('2026-09-22')
  })

  it('steps forward exactly one day per call', () => {
    expect(addDays('2026-09-20', 1)).toBe('2026-09-21')
    expect(addDays('2026-09-21', 1)).toBe('2026-09-22')
  })

  it('crosses month, year and leap-day boundaries', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
  })
})

describe('toDateString', () => {
  it('returns the local calendar date, not the UTC date', () => {
    expect(toDateString(new Date(2026, 8, 24, 0, 30))).toBe('2026-09-24')
    expect(toDateString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

describe('todayString', () => {
  it('uses the injected clock', () => {
    expect(todayString(new Date(2026, 8, 24, 0, 30))).toBe('2026-09-24')
  })
})
