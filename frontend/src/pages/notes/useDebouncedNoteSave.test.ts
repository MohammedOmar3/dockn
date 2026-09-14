import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebouncedNoteSave } from './useDebouncedNoteSave'

describe('useDebouncedNoteSave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('saves the scheduled note id and content after the delay elapses', () => {
    const save = vi.fn()
    const { result } = renderHook(() => useDebouncedNoteSave(save, 1500))

    act(() => {
      result.current.schedule('note-a', { text: 'hello' })
    })
    expect(save).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('note-a', { text: 'hello' })
  })

  it('does not lose an edit when the note is switched before the delay elapses', () => {
    const save = vi.fn()
    const { result } = renderHook(() => useDebouncedNoteSave(save, 1500))

    // User types in note-a...
    act(() => {
      result.current.schedule('note-a', { text: 'edit to note-a' })
    })

    // ...then switches to note-b after only 500ms — the app must flush
    // the pending note-a save instead of letting the timer fire against
    // whatever note is current by then.
    act(() => {
      vi.advanceTimersByTime(500)
      result.current.flush()
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('note-a', { text: 'edit to note-a' })

    // A later edit to note-b still debounces normally.
    act(() => {
      result.current.schedule('note-b', { text: 'edit to note-b' })
      vi.advanceTimersByTime(1500)
    })
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith('note-b', { text: 'edit to note-b' })
  })

  it('flush is a no-op when there is nothing pending', () => {
    const save = vi.fn()
    const { result } = renderHook(() => useDebouncedNoteSave(save, 1500))

    act(() => {
      result.current.flush()
    })

    expect(save).not.toHaveBeenCalled()
  })

  it('a second schedule call before the delay elapses replaces the pending save (no duplicate saves)', () => {
    const save = vi.fn()
    const { result } = renderHook(() => useDebouncedNoteSave(save, 1500))

    act(() => {
      result.current.schedule('note-a', { text: 'first draft' })
      vi.advanceTimersByTime(500)
      result.current.schedule('note-a', { text: 'second draft' })
      vi.advanceTimersByTime(1500)
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('note-a', { text: 'second draft' })
  })

  it('keeps schedule/flush referentially stable across re-renders even when save changes identity, and always calls the latest save', () => {
    const save1 = vi.fn()
    const save2 = vi.fn()
    const { result, rerender } = renderHook(
      ({ save }) => useDebouncedNoteSave(save, 1500),
      { initialProps: { save: save1 } },
    )

    const firstSchedule = result.current.schedule
    const firstFlush = result.current.flush

    rerender({ save: save2 })

    expect(result.current.schedule).toBe(firstSchedule)
    expect(result.current.flush).toBe(firstFlush)

    act(() => {
      result.current.schedule('note-a', { text: 'hello' })
      vi.advanceTimersByTime(1500)
    })

    expect(save1).not.toHaveBeenCalled()
    expect(save2).toHaveBeenCalledWith('note-a', { text: 'hello' })
  })
})
