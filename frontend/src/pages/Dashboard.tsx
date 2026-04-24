import { useQuery } from '@tanstack/react-query'
import { CheckSquare, BookOpen, BookText, TrendingUp, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { tasksApi, notebooksApi, activityApi } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import type { Task, Activity } from '@/types'

function isOverdue(task: Task): boolean {
  if (!task.due_date || task.status === 'done' || task.status === 'cancelled') return false
  return new Date(task.due_date) < new Date()
}

function today() {
  return new Date().toISOString().split('T')[0]
}

function StatCard({
  label,
  value,
  icon: Icon,
  to,
  sub,
  alert,
}: {
  label: string
  value: number | string
  icon: typeof CheckSquare
  to: string
  sub?: string
  alert?: boolean
}) {
  return (
    <Link
      to={to}
      className="flex flex-col gap-2 p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
    >
      <div className="flex items-center justify-between">
        <Icon size={20} className={alert ? 'text-red-500' : 'text-brand-500'} />
        {alert && <AlertCircle size={14} className="text-red-500" />}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        {sub && <p className="text-xs text-red-500 mt-0.5">{sub}</p>}
      </div>
    </Link>
  )
}

function ActivityFeed({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No activity today</p>
  }
  return (
    <ul className="flex flex-col gap-3">
      {activities.slice(0, 10).map((a) => (
        <li key={a.id} className="flex items-start gap-3">
          <div className="h-2 w-2 rounded-full bg-brand-400 mt-1.5 shrink-0" />
          <div>
            <p className="text-sm text-gray-800 dark:text-gray-200">{a.description}</p>
            <p className="text-xs text-gray-400">
              {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function Dashboard() {
  const { user } = useAuth()

  const { data: tasks = [] } = useQuery<Task[]>({ queryKey: ['tasks'], queryFn: tasksApi.list })
  const { data: notebooks = [] } = useQuery({ queryKey: ['notebooks'], queryFn: notebooksApi.list })
  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ['activity', today()],
    queryFn: () => activityApi.getByDate(today()),
  })

  const openTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled')
  const overdueTasks = tasks.filter(isOverdue)
  const doneTasks = tasks.filter((t) => t.status === 'done')
  const completionRate =
    tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {greeting}, {user?.first_name ?? 'there'} 👋
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Open tasks"
          value={openTasks.length}
          icon={CheckSquare}
          to="/tasks"
          sub={overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : undefined}
          alert={overdueTasks.length > 0}
        />
        <StatCard label="Notebooks" value={notebooks.length} icon={BookOpen} to="/notes" />
        <StatCard
          label="Completion rate"
          value={`${completionRate}%`}
          icon={TrendingUp}
          to="/tasks"
        />
        <StatCard label="Log streak" value="—" icon={BookText} to="/logs" />
      </div>

      {/* Overdue tasks */}
      {overdueTasks.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
            <AlertCircle size={14} /> Overdue Tasks
          </h2>
          <ul className="flex flex-col gap-2">
            {overdueTasks.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10"
              >
                <AlertCircle size={14} className="text-red-500 shrink-0" />
                <span className="text-sm text-gray-900 dark:text-gray-100 flex-1 truncate">{t.title}</span>
                <span className="text-xs text-red-500">
                  {t.due_date && new Date(t.due_date).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Today's activity */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Today's Activity
        </h2>
        <ActivityFeed activities={activities} />
      </section>
    </div>
  )
}
