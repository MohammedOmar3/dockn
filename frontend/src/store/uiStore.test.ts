import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from './uiStore'

describe('useUIStore.selectNote', () => {
  beforeEach(() => {
    useUIStore.setState({ selectedNotebookId: null, selectedNoteId: null })
  })

  it('sets notebook and note together in one call', () => {
    useUIStore.getState().selectNote('nb-1', 'note-1')

    const state = useUIStore.getState()
    expect(state.selectedNotebookId).toBe('nb-1')
    expect(state.selectedNoteId).toBe('note-1')
  })

  it('can select a notebook with no note selected', () => {
    useUIStore.getState().selectNote('nb-2', null)

    const state = useUIStore.getState()
    expect(state.selectedNotebookId).toBe('nb-2')
    expect(state.selectedNoteId).toBeNull()
  })
})
