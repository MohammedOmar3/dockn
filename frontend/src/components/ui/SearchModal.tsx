import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ArrowRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { searchApi } from '@/api/client'
import { useUIStore } from '@/store/uiStore'
import type { SearchResults } from '@/types'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function SearchModal() {
  const { searchOpen, setSearchOpen } = useUIStore()
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const debouncedQuery = useDebounce(query, 300)

  const { data } = useQuery<SearchResults>({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchApi.search(debouncedQuery),
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!searchOpen) {
      setQuery('')
    }
  }, [searchOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(!searchOpen)
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [searchOpen, setSearchOpen])

  if (!searchOpen) return null

  const hasResults =
    data && (data.tasks.length > 0 || data.notes.length > 0 || data.logs.length > 0)

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setSearchOpen(false)}
      />
      <div className="relative z-10 w-full max-w-xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, notes, logs…"
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 outline-none placeholder:text-gray-400"
          />
          <kbd className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
            Esc
          </kbd>
        </div>

        {debouncedQuery.length >= 2 && (
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            {!hasResults && (
              <p className="text-sm text-gray-500 text-center py-8">No results found</p>
            )}
            {data && data.tasks.length > 0 && (
              <section className="py-2">
                <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Tasks
                </p>
                {data.tasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => {
                      navigate('/tasks')
                      setSearchOpen(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                  >
                    <span className="flex-1 truncate text-gray-900 dark:text-gray-100">
                      {task.title}
                    </span>
                    <ArrowRight size={14} className="text-gray-400 shrink-0" />
                  </button>
                ))}
              </section>
            )}
            {data && data.notes.length > 0 && (
              <section className="py-2">
                <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Notes
                </p>
                {data.notes.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => {
                      navigate('/notes')
                      setSearchOpen(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                  >
                    <span className="flex-1 truncate text-gray-900 dark:text-gray-100">
                      {note.title}
                    </span>
                    <ArrowRight size={14} className="text-gray-400 shrink-0" />
                  </button>
                ))}
              </section>
            )}
            {data && data.logs.length > 0 && (
              <section className="py-2">
                <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Logs
                </p>
                {data.logs.map((log: { id: string; log_date: string; content_snippet: string }) => (
                  <button
                    key={log.id}
                    onClick={() => {
                      navigate('/logs')
                      setSearchOpen(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                  >
                    <span className="flex-1 truncate text-gray-900 dark:text-gray-100">
                      {log.log_date}
                    </span>
                    <ArrowRight size={14} className="text-gray-400 shrink-0" />
                  </button>
                ))}
              </section>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
