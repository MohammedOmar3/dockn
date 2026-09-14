import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { SearchModal } from './SearchModal'
import { useUIStore } from '@/store/uiStore'
import { searchApi } from '@/api/client'

vi.mock('@/api/client', () => ({
  searchApi: { search: vi.fn() },
}))

function renderModal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SearchModal />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SearchModal note selection', () => {
  beforeEach(() => {
    useUIStore.setState({
      searchOpen: true,
      selectedNotebookId: null,
      selectedNoteId: null,
    })
    vi.mocked(searchApi.search).mockResolvedValue({
      tasks: [],
      notes: [{ id: 'note-42', title: 'Roadmap draft', notebook_id: 'nb-7' }],
      logs: [],
    })
  })

  it('selects the clicked note and its notebook, not just navigating', async () => {
    renderModal()

    fireEvent.change(screen.getByPlaceholderText(/Search tasks, notes, logs/i), {
      target: { value: 'roadmap' },
    })

    const noteButton = await screen.findByText('Roadmap draft')
    fireEvent.click(noteButton)

    await waitFor(() => {
      expect(useUIStore.getState().selectedNoteId).toBe('note-42')
    })
    expect(useUIStore.getState().selectedNotebookId).toBe('nb-7')
  })
})
