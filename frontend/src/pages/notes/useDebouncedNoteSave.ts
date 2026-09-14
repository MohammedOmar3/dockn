import { useCallback, useRef } from 'react'

interface PendingSave {
  noteId: string
  content: Record<string, unknown>
}

/**
 * Debounces note-content saves, keyed to the specific note id an edit
 * belongs to (not to whatever note happens to be selected when the timer
 * fires). Call `flush()` whenever the user navigates away from the note
 * being edited (switching notes/notebooks, unmounting the editor) so a
 * pending edit is saved immediately instead of silently dropped or
 * mis-attributed to whatever note is selected by the time the timer fires.
 */
export function useDebouncedNoteSave(
  save: (noteId: string, content: Record<string, unknown>) => void,
  delayMs = 1500,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const pendingRef = useRef<PendingSave | null>(null)
  const saveRef = useRef(save)
  saveRef.current = save

  const flush = useCallback(() => {
    clearTimeout(timerRef.current)
    const pending = pendingRef.current
    if (pending) {
      pendingRef.current = null
      saveRef.current(pending.noteId, pending.content)
    }
  }, [])

  const schedule = useCallback(
    (noteId: string, content: Record<string, unknown>) => {
      pendingRef.current = { noteId, content }
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(flush, delayMs)
    },
    [flush, delayMs],
  )

  return { schedule, flush }
}
