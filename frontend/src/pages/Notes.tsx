import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Plus,
  MoreHorizontal,
  Trash2,
  Edit3,
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
} from 'lucide-react'
import clsx from 'clsx'
import { notebooksApi, notesApi } from '@/api/client'
import { useUIStore } from '@/store/uiStore'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import type { Notebook, Note } from '@/types'

// ─── Note tree item ───────────────────────────────────────────────────────────

function NoteTreeItem({
  note,
  selected,
  onSelect,
  onDelete,
}: {
  note: Note
  selected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={clsx(
        'group flex items-center gap-1.5 pl-7 pr-2 py-1.5 rounded-md cursor-pointer transition-colors',
        selected
          ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
      )}
      onClick={onSelect}
    >
      <FileText size={12} className="shrink-0 opacity-50" />
      <span className="flex-1 truncate text-sm">{note.title}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-red-500 transition-opacity shrink-0"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

// ─── Notebook section (tree) ──────────────────────────────────────────────────

function NotebookSection({
  notebook,
  expanded,
  onToggle,
  selectedNoteId,
  onSelectNote,
  onDeleteNote,
  onAddNote,
  onRename,
  onDelete,
}: {
  notebook: Notebook
  expanded: boolean
  onToggle: () => void
  selectedNoteId: string | null
  onSelectNote: (note: Note, notebookId: string) => void
  onDeleteNote: (noteId: string) => void
  onAddNote: (notebookId: string) => void
  onRename: (name: string) => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(notebook.name)
  const menuRef = useRef<HTMLDivElement>(null)

  const { data: notes = [] } = useQuery<Note[]>({
    queryKey: ['notes', notebook.id],
    queryFn: () => notesApi.list(notebook.id),
    enabled: expanded,
  })

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div className="mb-0.5">
      {renaming ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) { onRename(name.trim()); setRenaming(false) }
          }}
          className="px-2 py-1"
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setRenaming(false)}
            className="w-full px-2 py-1 text-xs rounded border border-brand-400 outline-none bg-white dark:bg-gray-800 dark:text-gray-100"
          />
        </form>
      ) : (
        <div className="group flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 select-none">
          <button onClick={onToggle} className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer">
            {expanded
              ? <ChevronDown size={13} className="shrink-0 text-gray-400" />
              : <ChevronRight size={13} className="shrink-0 text-gray-400" />}
            <BookOpen size={13} className="shrink-0 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{notebook.name}</span>
            {notebook.is_inbox && (
              <span className="text-[10px] uppercase tracking-wide text-gray-400 ml-1">inbox</span>
            )}
          </button>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onAddNote(notebook.id) }}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
              title="New note"
            >
              <Plus size={12} />
            </button>
            {!notebook.is_inbox && (
              <div ref={menuRef} className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
                >
                  <MoreHorizontal size={12} />
                </button>
                {menuOpen && (
                  <div className="absolute left-0 top-full mt-1 w-36 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                    <button
                      onClick={(e) => { e.stopPropagation(); setRenaming(true); setMenuOpen(false) }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <Edit3 size={12} /> Rename
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete() }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {expanded && (
        <div className="mt-0.5 mb-1">
          {notes.length === 0 ? (
            <p className="pl-8 py-1 text-xs text-gray-400 italic">No notes</p>
          ) : (
            notes.map((note) => (
              <NoteTreeItem
                key={note.id}
                note={note}
                selected={note.id === selectedNoteId}
                onSelect={() => onSelectNote(note, notebook.id)}
                onDelete={() => onDeleteNote(note.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── TipTap toolbar ───────────────────────────────────────────────────────────

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
    <div className="flex items-center gap-0.5 px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-wrap">
      {[
        { label: 'B', action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
        { label: 'I', action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
        { label: 'S', action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive('strike') },
        { label: 'Code', action: () => editor.chain().focus().toggleCode().run(), active: editor.isActive('code') },
        { label: 'H1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive('heading', { level: 1 }) },
        { label: 'H2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
        { label: 'UL', action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
        { label: 'OL', action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
        { label: '"""', action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote') },
      ].map(({ label, action, active }) => (
        <button key={label} onClick={action} className={btn(active)}>
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── Main Notes page ──────────────────────────────────────────────────────────

export default function Notes() {
  const { selectedNotebookId, setSelectedNotebook: setSelectedNotebookId, selectedNoteId, setSelectedNote: setSelectedNoteId } = useUIStore()
  const { success, error } = useToast()
  const qc = useQueryClient()

  const [expandedNotebooks, setExpandedNotebooks] = useState<Set<string>>(new Set())
  const [newNotebookOpen, setNewNotebookOpen] = useState(false)
  const [newNotebookName, setNewNotebookName] = useState('')
  const [deleteNotebookId, setDeleteNotebookId] = useState<string | null>(null)
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null)
  const [noteTitleEdit, setNoteTitleEdit] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()

  // ── Notebooks query ──
  const { data: notebooks = [] } = useQuery<Notebook[]>({
    queryKey: ['notebooks'],
    queryFn: notebooksApi.list,
  })

  // Expand all notebooks on first load and auto-select first
  useEffect(() => {
    if (notebooks.length > 0) {
      setExpandedNotebooks((prev) =>
        prev.size === 0 ? new Set(notebooks.map((nb) => nb.id)) : prev,
      )
      if (!selectedNotebookId) {
        setSelectedNotebookId(notebooks[0].id)
      }
    }
  }, [notebooks, selectedNotebookId, setSelectedNotebookId])

  // ── Notes query for selected notebook (drives the editor) ──
  const { data: notes = [] } = useQuery<Note[]>({
    queryKey: ['notes', selectedNotebookId],
    queryFn: () => notesApi.list(selectedNotebookId!),
    enabled: !!selectedNotebookId,
  })

  // Auto-select first note when notebook changes
  useEffect(() => {
    if (notes.length > 0 && !notes.find((n) => n.id === selectedNoteId)) {
      setSelectedNoteId(notes[0].id)
    }
  }, [notes, selectedNoteId, setSelectedNoteId])

  const selectedNote = notes.find((n) => n.id === selectedNoteId)

  // ── Editor ──
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
    content: selectedNote?.content ?? '',
    editorProps: {
      attributes: { class: 'prose dark:prose-invert max-w-none focus:outline-none p-6' },
    },
    onUpdate: ({ editor }) => {
      if (!selectedNoteId) return
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        updateNote.mutate({ content: editor.getJSON() })
      }, 1500)
    },
  })

  // Sync editor when note changes
  useEffect(() => {
    if (editor && selectedNote) {
      editor.commands.setContent(selectedNote.content ?? '')
      setNoteTitleEdit(selectedNote.title)
    }
  }, [selectedNote?.id])

  const toggleNotebook = (id: string) => {
    setExpandedNotebooks((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Mutations ──
  const createNotebook = useMutation({
    mutationFn: (name: string) => notebooksApi.create({ name }),
    onSuccess: (nb) => {
      qc.invalidateQueries({ queryKey: ['notebooks'] })
      setSelectedNotebookId(nb.id)
      setExpandedNotebooks((prev) => new Set([...prev, nb.id]))
      setNewNotebookOpen(false)
      setNewNotebookName('')
      success('Notebook created')
    },
    onError: () => error('Failed to create notebook'),
  })

  const renameNotebook = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      notebooksApi.update(id, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notebooks'] }),
    onError: () => error('Failed to rename notebook'),
  })

  const deleteNotebook = useMutation({
    mutationFn: (id: string) => notebooksApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notebooks'] })
      setDeleteNotebookId(null)
      success('Notebook deleted')
    },
    onError: () => error('Failed to delete notebook'),
  })

  const createNote = useMutation({
    mutationFn: (notebookId: string) =>
      notesApi.create({ title: 'Untitled', notebook_id: notebookId, content: {} }),
    onSuccess: (note, notebookId) => {
      qc.invalidateQueries({ queryKey: ['notes', notebookId] })
      setSelectedNotebookId(notebookId)
      setSelectedNoteId(note.id)
      success('Note created')
    },
    onError: () => error('Failed to create note'),
  })

  const updateNote = useMutation({
    mutationFn: (data: { title?: string; content?: Record<string, unknown> }) =>
      notesApi.update(selectedNoteId!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', selectedNotebookId] }),
  })

  const deleteNote = useMutation({
    mutationFn: (id: string) => notesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      setDeleteNoteId(null)
      if (deleteNoteId === selectedNoteId) setSelectedNoteId(null)
      success('Note deleted')
    },
    onError: () => error('Failed to delete note'),
  })

  const handleTitleBlur = useCallback(() => {
    if (selectedNoteId && noteTitleEdit.trim() && noteTitleEdit !== selectedNote?.title) {
      updateNote.mutate({ title: noteTitleEdit.trim() })
    }
  }, [selectedNoteId, noteTitleEdit, selectedNote?.title])

  return (
    <div className="flex h-full">
      {/* Tree sidebar */}
      <aside className="w-56 shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200 dark:border-gray-800">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Notes</span>
          <button
            onClick={() => setNewNotebookOpen(true)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            title="New notebook"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {notebooks.map((nb) => (
            <NotebookSection
              key={nb.id}
              notebook={nb}
              expanded={expandedNotebooks.has(nb.id)}
              onToggle={() => toggleNotebook(nb.id)}
              selectedNoteId={selectedNoteId}
              onSelectNote={(note, notebookId) => {
                setSelectedNoteId(note.id)
                setSelectedNotebookId(notebookId)
              }}
              onDeleteNote={(noteId) => setDeleteNoteId(noteId)}
              onAddNote={(notebookId) => createNote.mutate(notebookId)}
              onRename={(name) => renameNotebook.mutate({ id: nb.id, name })}
              onDelete={() => setDeleteNotebookId(nb.id)}
            />
          ))}
        </div>
      </aside>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white dark:bg-gray-950">
        {selectedNote ? (
          <>
            <div className="px-6 pt-6 pb-2 border-b border-gray-100 dark:border-gray-800">
              <input
                value={noteTitleEdit}
                onChange={(e) => setNoteTitleEdit(e.target.value)}
                onBlur={handleTitleBlur}
                className="w-full text-2xl font-bold text-gray-900 dark:text-white bg-transparent outline-none placeholder:text-gray-300"
                placeholder="Note title"
              />
              <p className="text-xs text-gray-400 mt-1">
                Last updated {new Date(selectedNote.updated_at).toLocaleString()}
              </p>
            </div>
            <EditorToolbar editor={editor} />
            <div className="flex-1 overflow-y-auto">
              <EditorContent editor={editor} />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <BookOpen size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Select or create a note</p>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <Modal open={newNotebookOpen} onClose={() => setNewNotebookOpen(false)} title="New Notebook" size="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (newNotebookName.trim()) createNotebook.mutate(newNotebookName.trim())
          }}
          className="flex flex-col gap-4"
        >
          <Input
            label="Notebook name"
            autoFocus
            value={newNotebookName}
            onChange={(e) => setNewNotebookName(e.target.value)}
            placeholder="e.g. Work, Personal"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setNewNotebookOpen(false)}>Cancel</Button>
            <Button size="sm" loading={createNotebook.isPending} disabled={!newNotebookName.trim()}>Create</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteNotebookId} onClose={() => setDeleteNotebookId(null)} title="Delete Notebook" size="sm">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          This will permanently delete the notebook and all its notes.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDeleteNotebookId(null)}>Cancel</Button>
          <Button
            variant="danger"
            size="sm"
            loading={deleteNotebook.isPending}
            onClick={() => deleteNotebookId && deleteNotebook.mutate(deleteNotebookId)}
          >
            Delete
          </Button>
        </div>
      </Modal>

      <Modal open={!!deleteNoteId} onClose={() => setDeleteNoteId(null)} title="Delete Note" size="sm">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          This note will be permanently deleted.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDeleteNoteId(null)}>Cancel</Button>
          <Button
            variant="danger"
            size="sm"
            loading={deleteNote.isPending}
            onClick={() => deleteNoteId && deleteNote.mutate(deleteNoteId)}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  )
}

