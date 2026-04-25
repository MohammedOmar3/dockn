import { useState } from 'react'
import { useChatRuntime, AssistantChatTransport } from '@assistant-ui/react-ai-sdk'
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  ThreadListPrimitive,
  ThreadListItemPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  useThreadListItemRuntime,
} from '@assistant-ui/react'
import { MessageSquare, Plus, Trash2, Globe, Bot, User } from 'lucide-react'
import clsx from 'clsx'

const MODELS = [
  { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'gpt-4.1', label: 'GPT-4.1' },
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet' },
  { id: 'claude-opus-4', label: 'Claude Opus' },
]

// ─── Thread List Item ────────────────────────────────────────────────────────

function ThreadItem() {
  const runtime = useThreadListItemRuntime()
  const state = runtime.getState()

  return (
    <ThreadListItemPrimitive.Root
      className={clsx(
        'group flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors w-full',
        state.isMain
          ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
      )}
    >
      <ThreadListItemPrimitive.Trigger className="flex items-center gap-2 min-w-0 flex-1 text-left">
        <MessageSquare size={13} className="shrink-0" />
        <span className="truncate text-xs">
          <ThreadListItemPrimitive.Title fallback="New conversation" />
        </span>
      </ThreadListItemPrimitive.Trigger>
      <ThreadListItemPrimitive.Delete className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-0.5">
        <Trash2 size={12} />
      </ThreadListItemPrimitive.Delete>
    </ThreadListItemPrimitive.Root>
  )
}

// ─── Thread List Sidebar ────────────────────────────────────────────────────

function ThreadListSidebar({
  selectedModel,
  onModelChange,
  webSearch,
  onWebSearchChange,
}: {
  selectedModel: string
  onModelChange: (m: string) => void
  webSearch: boolean
  onWebSearchChange: (v: boolean) => void
}) {
  return (
    <div className="flex flex-col h-full w-64 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200 dark:border-gray-800">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">AI Chat</span>
        <ThreadListPrimitive.New asChild>
          <button className="flex items-center gap-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white px-2.5 py-1.5 rounded-lg transition-colors">
            <Plus size={13} />
            New
          </button>
        </ThreadListPrimitive.New>
      </div>

      {/* Model selector */}
      <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-800">
        <label className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1.5 block">Model</label>
        <select
          value={selectedModel}
          onChange={e => onModelChange(e.target.value)}
          className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {MODELS.map(m => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Web search toggle */}
      <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => onWebSearchChange(!webSearch)}
          className={clsx(
            'flex items-center gap-2 text-sm w-full px-2.5 py-1.5 rounded-lg transition-colors font-medium',
            webSearch
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
          )}
        >
          <Globe size={14} />
          Web search {webSearch ? 'on' : 'off'}
        </button>
      </div>

      {/* Thread list */}
      <ThreadListPrimitive.Root>
        <nav className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-0.5">
          <ThreadListPrimitive.Items components={{ ThreadListItem: ThreadItem }} />
        </nav>
      </ThreadListPrimitive.Root>
    </div>
  )
}

// ─── Message Components ──────────────────────────────────────────────────────

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end gap-3 px-4 py-2">
      <div className="flex flex-col items-end gap-1 max-w-[75%]">
        <div className="bg-brand-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed">
          <MessagePrimitive.Content />
        </div>
      </div>
      <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center shrink-0 mt-0.5">
        <User size={13} className="text-brand-600 dark:text-brand-400" />
      </div>
    </MessagePrimitive.Root>
  )
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex gap-3 px-4 py-2">
      <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 mt-0.5">
        <Bot size={13} className="text-gray-600 dark:text-gray-400" />
      </div>
      <div className="flex flex-col gap-1 max-w-[75%]">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed text-gray-900 dark:text-gray-100">
          <MessagePrimitive.Content />
        </div>
      </div>
    </MessagePrimitive.Root>
  )
}

// ─── Composer ────────────────────────────────────────────────────────────────

function Composer() {
  return (
    <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
      <ComposerPrimitive.Root className="flex flex-col gap-2 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden focus-within:ring-2 focus-within:ring-brand-500 transition-shadow">
        <ComposerPrimitive.Input
          className="w-full bg-transparent px-4 pt-3 pb-2 text-sm text-gray-900 dark:text-white resize-none outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 min-h-[44px] max-h-[200px]"
          placeholder="Send a message…"
          rows={1}
        />
        <div className="flex items-center justify-end px-3 pb-2">
          <ComposerPrimitive.Send className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
      <p className="text-xs text-gray-400 dark:text-gray-600 text-center mt-2">
        AI can make mistakes. Check important info.
      </p>
    </div>
  )
}

// ─── Main Thread Area ─────────────────────────────────────────────────────────

function ChatThread() {
  return (
    <ThreadPrimitive.Root className="flex flex-col flex-1 min-h-0">
      {/* Empty state */}
      <ThreadPrimitive.Empty>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6 py-16">
          <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center">
            <MessageSquare size={22} className="text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Start a conversation</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Ask anything — your messages are streamed in real time.</p>
          </div>
        </div>
      </ThreadPrimitive.Empty>

      {/* Messages */}
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto py-4 flex flex-col gap-1">
        <ThreadPrimitive.Messages
          components={{
            UserMessage,
            AssistantMessage,
          }}
        />
        <ThreadPrimitive.If running>
          <div className="flex gap-3 px-4 py-2">
            <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
              <Bot size={13} className="text-gray-600 dark:text-gray-400" />
            </div>
            <div className="flex items-center gap-1 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" />
            </div>
          </div>
        </ThreadPrimitive.If>
      </ThreadPrimitive.Viewport>

      {/* Composer */}
      <Composer />
    </ThreadPrimitive.Root>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Chat() {
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini')
  const [webSearch, setWebSearch] = useState(false)

  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: '/api/chat',
      body: { model: selectedModel, webSearch },
    }),
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-full overflow-hidden">
        <ThreadListSidebar
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          webSearch={webSearch}
          onWebSearchChange={setWebSearch}
        />
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-950">
          <ChatThread />
        </div>
      </div>
    </AssistantRuntimeProvider>
  )
}
