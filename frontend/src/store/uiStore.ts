import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  // Notes sidebar
  selectedNotebookId: string | null
  selectedNoteId: string | null
  sidebarOpen: boolean

  // Theme
  theme: 'light' | 'dark'

  // Global search
  searchOpen: boolean

  // Capture modal
  captureOpen: boolean

  // Actions
  setSelectedNotebook: (id: string | null) => void
  setSelectedNote: (id: string | null) => void
  setSidebarOpen: (open: boolean) => void
  toggleTheme: () => void
  setSearchOpen: (open: boolean) => void
  setCaptureOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      selectedNotebookId: null,
      selectedNoteId: null,
      sidebarOpen: true,
      theme: 'light',
      searchOpen: false,
      captureOpen: false,

      setSelectedNotebook: (id) =>
        set({ selectedNotebookId: id, selectedNoteId: null }),
      setSelectedNote: (id) => set({ selectedNoteId: id }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleTheme: () =>
        set((s) => {
          const next = s.theme === 'light' ? 'dark' : 'light'
          document.documentElement.classList.toggle('dark', next === 'dark')
          return { theme: next }
        }),
      setSearchOpen: (open) => set({ searchOpen: open }),
      setCaptureOpen: (open) => set({ captureOpen: open }),
    }),
    {
      name: 'dockn-ui',
      partialState: (s: UIState) => ({ theme: s.theme, sidebarOpen: s.sidebarOpen }),
    } as Parameters<typeof persist>[1],
  ),
)

// Apply persisted theme on load
if (typeof document !== 'undefined') {
  const stored = localStorage.getItem('dockn-ui')
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      if (parsed?.state?.theme === 'dark') {
        document.documentElement.classList.add('dark')
      }
    } catch {}
  }
}
