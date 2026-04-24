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

      setSelectedNotebook: (id: string | null) =>
        set({ selectedNotebookId: id, selectedNoteId: null }),
      setSelectedNote: (id: string | null) => set({ selectedNoteId: id }),
      setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
      toggleTheme: () =>
        set((s: UIState) => {
          const next = s.theme === 'light' ? 'dark' : 'light'
          document.documentElement.classList.toggle('dark', next === 'dark')
          return { theme: next }
        }),
      setSearchOpen: (open: boolean) => set({ searchOpen: open }),
      setCaptureOpen: (open: boolean) => set({ captureOpen: open }),
    }),
    {
      name: 'dockn-ui',
      partialize: (s: UIState) => ({ theme: s.theme, sidebarOpen: s.sidebarOpen }),
    },
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
