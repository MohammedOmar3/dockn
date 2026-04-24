import { useEffect, useRef, useState } from 'react'
import { Zap } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { captureApi } from '@/api/client'
import { useUiStore } from '@/store/uiStore'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'

export function CaptureModal() {
  const { captureOpen, setCaptureOpen } = useUiStore()
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { success, error } = useToast()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (captureOpen) {
      setText('')
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [captureOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && captureOpen) {
        e.preventDefault()
        if (text.trim()) mutation.mutate()
      }
      if (e.key === 'Escape' && captureOpen) {
        setCaptureOpen(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [captureOpen, text, setCaptureOpen])

  const mutation = useMutation({
    mutationFn: () => captureApi.capture(text.trim()),
    onSuccess: () => {
      success('Captured!')
      setCaptureOpen(false)
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['notes'] })
    },
    onError: () => error('Failed to capture'),
  })

  if (!captureOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setCaptureOpen(false)}
      />
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <Zap size={16} className="text-brand-500 shrink-0" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Quick Capture</p>
          <span className="ml-auto text-xs text-gray-400">
            Start with <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">@task</code> for
            a task
          </span>
        </div>
        <div className="px-4 pb-4">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's on your mind? Use @task to capture a task…"
            rows={4}
            className="w-full bg-transparent text-sm text-gray-900 dark:text-gray-100 outline-none resize-none placeholder:text-gray-400"
          />
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <Button variant="ghost" size="sm" onClick={() => setCaptureOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            loading={mutation.isPending}
            disabled={!text.trim()}
            onClick={() => mutation.mutate()}
          >
            Capture
            <kbd className="text-xs opacity-70 ml-1">⌘↵</kbd>
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
