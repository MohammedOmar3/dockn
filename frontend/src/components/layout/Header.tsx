import { Search, Zap, Sun, Moon, User, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { useUIStore } from '@/store/uiStore'
import { useAuth } from '@/context/AuthContext'

export function Header() {
  const { setSearchOpen, setCaptureOpen, theme, toggleTheme } = useUIStore()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <header className="h-14 flex items-center justify-end gap-2 px-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
      {/* Search */}
      <button
        onClick={() => setSearchOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-500 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        aria-label="Search (Ctrl+K)"
      >
        <Search size={14} />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden sm:inline text-xs opacity-60">⌘K</kbd>
      </button>

      {/* Capture */}
      <button
        onClick={() => setCaptureOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-brand-600 bg-brand-50 dark:bg-brand-900/30 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors"
        aria-label="Quick capture"
      >
        <Zap size={14} />
        <span className="hidden sm:inline">Capture</span>
      </button>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* User menu */}
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setUserMenuOpen((v) => !v)}
          className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="User menu"
          aria-expanded={userMenuOpen}
        >
          <div className="h-7 w-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-semibold">
            {user?.first_name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
        </button>

        {userMenuOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-30">
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
              <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                {user ? `${user.first_name} ${user.last_name}`.trim() : 'User'}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={() => {
                navigate('/settings')
                setUserMenuOpen(false)
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <User size={14} />
              Settings
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
