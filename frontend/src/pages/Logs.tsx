import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { ChevronLeft, ChevronRight, BookText, Plus } from 'lucide-react'
import clsx from 'clsx'
import { logsApi } from '@/api/client'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import type { DailyLog } from '@/types'

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null
  const btn = (active: boolean) =>
    clsx(
      'px-2 py-1 rounded text-xs font-medium transition-colors',
      active
        ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800',
    )
  return (
    <div className="flex items-center gap-0.5 px-6 py-2 border-b border-gray-100 dark:border-gray-800 flex-wrap">
      {[
        { label: 'B', action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
        { label: 'I', action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
        { label: 'H2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
        { label: 'H3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }) },
        { label: 'UL', action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
        { label: 'OL', action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
        { label: 'Code', action: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive('codeBlock') },
      ].map(({ label, action, active }) => (
        <button key={label} onClick={action} className={btn(active)}>
          {label}
        </button>
      ))}
    </div>
  )
}

export default function Logs() {
  const today = formatDate(new Date())
  const [selectedDate, setSelectedDate] = useState(today)
  const { success, error } = useToast()
  const qc = useQueryClient()
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  const [moodScore, setMoodScore] = useState<number | undefined>()

  const { data: log } = useQuery<DailyLog | null>({
    queryKey: ['log', selectedDate],
    queryFn: async () => {
      try {
        return await logsApi.getByDate(selectedDate)
      } catch {
        return null
      }
    },
  })

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "How did your day go? Capture thoughts, wins, blockers…" }),
    ],
    content: log?.content ?? '',
    editorProps: {
      attributes: { class: 'prose dark:prose-invert max-w-none focus:outline-none' },
    },
    onUpdate: ({ editor }) => {
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        upsertLog.mutate({ content: editor.getJSON() })
      }, 1500)
    },
  })

  // Sync editor when log changes
  useEffect(() => {
    if (editor && log !== undefined) {
      editor.commands.setContent(log?.content ?? '')
      setMoodScore(log?.mood_score ?? undefined)
    }
  }, [selectedDate, log?.id])

  const upsertLog = useMutation({
    mutationFn: async (data: { content?: unknown; mood_score?: number }) => {
      if (log) {
        return logsApi.update(log.id, data)
      } else {
        return logsApi.create({
          log_date: selectedDate,
          content: editor?.getJSON(),
          ...data,
        })
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['log', selectedDate] }),
    onError: () => error('Failed to save log'),
  })

  const navigateDay = (delta: number) => {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    setSelectedDate(formatDate(d))
  }

  const isToday = selectedDate === today
  const isFuture = selectedDate > today

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateDay(-1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-gray-900 dark:text-white">
              {formatDisplayDate(selectedDate)}
            </h1>
            {isToday && <p className="text-xs text-brand-600 dark:text-brand-400">Today</p>}
          </div>
          <button
            onClick={() => navigateDay(1)}
            disabled={isToday}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Mood */}
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => {
                  setMoodScore(n)
                  upsertLog.mutate({ mood_score: n })
                }}
                className={clsx(
                  'text-lg transition-transform hover:scale-110',
                  moodScore === n ? 'scale-110' : 'opacity-40',
                )}
                title={['Terrible', 'Bad', 'Okay', 'Good', 'Great'][n - 1]}
              >
                {['😞', '😕', '😐', '🙂', '😄'][n - 1]}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => setSelectedDate(today)}
            disabled={isToday}
          >
            Today
          </Button>
        </div>
      </div>

      {isFuture ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center">
          <BookText size={40} className="text-gray-300 dark:text-gray-700" />
          <p className="text-sm text-gray-400">Can't log future dates</p>
          <Button size="sm" variant="secondary" onClick={() => setSelectedDate(today)}>
            Go to today
          </Button>
        </div>
      ) : (
        <>
          <EditorToolbar editor={editor} />
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-6">
              <EditorContent editor={editor} />
            </div>
          </div>
          {upsertLog.isPending && (
            <div className="px-6 py-2 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800">
              Saving…
            </div>
          )}
        </>
      )}
    </div>
  )
}
