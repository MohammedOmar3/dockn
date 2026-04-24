import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, CheckSquare, Square, Calendar } from 'lucide-react'
import clsx from 'clsx'
import { tasksApi } from '@/api/client'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import type { Task, TaskPriority, TaskStatus } from '@/types'

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: 'text-red-600 bg-red-50 dark:bg-red-900/20',
  high: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
  medium: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
  low: 'text-gray-500 bg-gray-50 dark:bg-gray-800',
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
  cancelled: 'Cancelled',
}

function isOverdue(task: Task): boolean {
  if (!task.due_date || task.status === 'done' || task.status === 'cancelled') return false
  return new Date(task.due_date) < new Date()
}

function TaskCard({
  task,
  onToggle,
  onDelete,
}: {
  task: Task
  onToggle: () => void
  onDelete: () => void
}) {
  const overdue = isOverdue(task)
  const done = task.status === 'done'

  return (
    <div
      className={clsx(
        'group flex items-start gap-3 p-4 rounded-xl border transition-colors bg-white dark:bg-gray-900',
        overdue
          ? 'border-red-300 dark:border-red-700 ring-1 ring-red-300 dark:ring-red-700'
          : 'border-gray-200 dark:border-gray-800',
        done && 'opacity-60',
      )}
    >
      <button
        onClick={onToggle}
        className="mt-0.5 shrink-0 text-gray-400 hover:text-brand-600 transition-colors"
      >
        {done ? <CheckSquare size={18} className="text-brand-600" /> : <Square size={18} />}
      </button>

      <div className="flex-1 min-w-0">
        <p className={clsx('text-sm font-medium text-gray-900 dark:text-gray-100', done && 'line-through')}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={clsx('text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full', PRIORITY_COLORS[task.priority])}>
            {task.priority}
          </span>
          <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
            {STATUS_LABELS[task.status]}
          </span>
          {task.due_date && (
            <span className={clsx('flex items-center gap-1 text-[10px]', overdue ? 'text-red-500' : 'text-gray-400')}>
              <Calendar size={10} />
              {new Date(task.due_date).toLocaleDateString()}
              {overdue && ' overdue'}
            </span>
          )}
          {task.tags?.map((tag) => (
            <span key={tag.id} className="text-[10px] px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400">
              #{tag.name}
            </span>
          ))}
        </div>
      </div>

      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 transition-all shrink-0"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

const FILTERS: { label: string; status?: TaskStatus | 'overdue' }[] = [
  { label: 'All' },
  { label: 'To Do', status: 'todo' },
  { label: 'In Progress', status: 'in_progress' },
  { label: 'Done', status: 'done' },
  { label: 'Overdue', status: 'overdue' },
]

export default function Tasks() {
  const { success, error } = useToast()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<string>('All')
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as TaskPriority,
    due_date: '',
  })

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: tasksApi.list,
  })

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'All') return true
    if (filter === 'Overdue') return isOverdue(t)
    return STATUS_LABELS[t.status] === filter
  })

  // Sort: urgent first, then by due date
  const sorted = [...filteredTasks].sort((a, b) => {
    const pOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
    const pd = pOrder[a.priority] - pOrder[b.priority]
    if (pd !== 0) return pd
    if (!a.due_date && !b.due_date) return 0
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  })

  const createTask = useMutation({
    mutationFn: () =>
      tasksApi.create({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority,
        due_date: form.due_date || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      setCreateOpen(false)
      setForm({ title: '', description: '', priority: 'medium', due_date: '' })
      success('Task created')
    },
    onError: () => error('Failed to create task'),
  })

  const toggleTask = useMutation({
    mutationFn: (task: Task) =>
      tasksApi.update(task.id, { status: task.status === 'done' ? 'todo' : 'done' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
    onError: () => error('Failed to update task'),
  })

  const deleteTask = useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      setDeleteId(null)
      success('Task deleted')
    },
    onError: () => error('Failed to delete task'),
  })

  const overdueCnt = tasks.filter(isOverdue).length

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Tasks</h1>
          {overdueCnt > 0 && (
            <p className="text-xs text-red-500 mt-0.5">
              {overdueCnt} overdue task{overdueCnt > 1 ? 's' : ''}
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> New task
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-gray-200 dark:border-gray-800">
        {FILTERS.map(({ label }) => (
          <button
            key={label}
            onClick={() => setFilter(label)}
            className={clsx(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors',
              filter === label
                ? 'bg-brand-600 text-white'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800',
            )}
          >
            {label}
            {label === 'Overdue' && overdueCnt > 0 && (
              <span className="ml-1 bg-red-500 text-white rounded-full px-1.5 py-0.5 text-[9px]">
                {overdueCnt}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
            <CheckSquare size={40} className="text-gray-300 dark:text-gray-700" />
            <p className="text-sm text-gray-400">No tasks here</p>
            <Button size="sm" variant="secondary" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> Create one
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 max-w-3xl">
            {sorted.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={() => toggleTask.mutate(task)}
                onDelete={() => setDeleteId(task.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Task">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (form.title.trim()) createTask.mutate()
          }}
          className="flex flex-col gap-4"
        >
          <Input
            label="Title"
            autoFocus
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="What needs to be done?"
          />
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Optional details…"
            rows={3}
          />
          <div className="flex gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-300"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <Input
              label="Due date"
              type="date"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              className="flex-1"
            />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={createTask.isPending} disabled={!form.title.trim()}>
              Create
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Task" size="sm">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          This task will be permanently deleted.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDeleteId(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={deleteTask.isPending}
            onClick={() => deleteId && deleteTask.mutate(deleteId)}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  )
}
