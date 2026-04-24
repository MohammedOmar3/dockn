import { NavLink, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  CheckSquare,
  BookText,
  Layout,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import clsx from 'clsx'
import { useUiStore } from '@/store/uiStore'

const NAV = [
  { to: '/', icon: Layout, label: 'Dashboard' },
  { to: '/notes', icon: BookOpen, label: 'Notes' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/logs', icon: BookText, label: 'Daily Log' },
  { to: '/whiteboards', icon: Activity, label: 'Whiteboards' },
]

export function AppSidebar() {
  const { sidebarOpen, setSidebarOpen } = useUiStore()

  return (
    <aside
      className={clsx(
        'flex flex-col h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-200',
        sidebarOpen ? 'w-52' : 'w-14',
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 h-14 px-3 border-b border-gray-200 dark:border-gray-800">
        <span className="h-7 w-7 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
          D
        </span>
        {sidebarOpen && (
          <span className="text-sm font-semibold text-gray-900 dark:text-white tracking-tight">
            dockn
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 flex flex-col gap-1 px-2 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100',
              )
            }
          >
            <Icon size={18} className="shrink-0" />
            {sidebarOpen && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Settings + collapse */}
      <div className="px-2 py-3 border-t border-gray-200 dark:border-gray-800 flex flex-col gap-1">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100',
            )
          }
        >
          <Settings size={18} className="shrink-0" />
          {sidebarOpen && <span>Settings</span>}
        </NavLink>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? (
            <>
              <ChevronLeft size={18} className="shrink-0" />
              <span>Collapse</span>
            </>
          ) : (
            <ChevronRight size={18} className="shrink-0" />
          )}
        </button>
      </div>
    </aside>
  )
}
