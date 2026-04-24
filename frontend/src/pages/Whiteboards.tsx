import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Excalidraw } from '@excalidraw/excalidraw'
import { Plus, Folder, Trash2, Edit3, ChevronDown, ChevronRight, Layout } from 'lucide-react'
import clsx from 'clsx'
import { whiteboardsApi, foldersApi } from '@/api/client'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import type { Whiteboard, WhiteboardFolder } from '@/types'

export default function Whiteboards() {
  const { success, error } = useToast()
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newBoardOpen, setNewBoardOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newBoardName, setNewBoardName] = useState('')
  const [newBoardFolderId, setNewBoardFolderId] = useState<string | undefined>()
  const [deleteWbId, setDeleteWbId] = useState<string | null>(null)
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null)
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout>>()

  const { data: folders = [] } = useQuery<WhiteboardFolder[]>({
    queryKey: ['wb-folders'],
    queryFn: foldersApi.list,
  })

  const { data: boards = [] } = useQuery<Whiteboard[]>({
    queryKey: ['whiteboards'],
    queryFn: whiteboardsApi.list,
  })

  const selectedBoard = boards.find((b) => b.id === selectedId)

  // Group boards by folder
  const byFolder = new Map<string | null, Whiteboard[]>()
  boards.forEach((b) => {
    const key = b.folder_id ?? null
    if (!byFolder.has(key)) byFolder.set(key, [])
    byFolder.get(key)!.push(b)
  })

  const unfiledBoards = byFolder.get(null) ?? []

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const createFolder = useMutation({
    mutationFn: () => foldersApi.create({ name: newFolderName.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wb-folders'] })
      setNewFolderOpen(false)
      setNewFolderName('')
      success('Folder created')
    },
    onError: () => error('Failed to create folder'),
  })

  const deleteFolder = useMutation({
    mutationFn: (id: string) => foldersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wb-folders'] })
      qc.invalidateQueries({ queryKey: ['whiteboards'] })
      setDeleteFolderId(null)
      success('Folder deleted — boards moved to Unfiled')
    },
    onError: () => error('Failed to delete folder'),
  })

  const createBoard = useMutation({
    mutationFn: () =>
      whiteboardsApi.create({ title: newBoardName.trim(), folder_id: newBoardFolderId }),
    onSuccess: (wb) => {
      qc.invalidateQueries({ queryKey: ['whiteboards'] })
      setNewBoardOpen(false)
      setNewBoardName('')
      setNewBoardFolderId(undefined)
      setSelectedId(wb.id)
      success('Whiteboard created')
    },
    onError: () => error('Failed to create whiteboard'),
  })

  const deleteBoard = useMutation({
    mutationFn: (id: string) => whiteboardsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whiteboards'] })
      setDeleteWbId(null)
      setSelectedId(null)
      success('Whiteboard deleted')
    },
    onError: () => error('Failed to delete whiteboard'),
  })

  const handleExcalidrawChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (elements: any, appState: any) => {
      if (!selectedId) return
      clearTimeout(saveTimer)
      const t = setTimeout(() => {
        whiteboardsApi
          .update(selectedId, { data: { elements, appState } })
          .then(() => qc.invalidateQueries({ queryKey: ['whiteboards'] }))
      }, 2000)
      setSaveTimer(t)
    },
    [selectedId, saveTimer, qc],
  )

  const BoardItem = ({ board }: { board: Whiteboard }) => (
    <div
      className={clsx(
        'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors',
        selectedId === board.id
          ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
      )}
      onClick={() => setSelectedId(board.id)}
    >
      <Layout size={14} className="shrink-0 opacity-60" />
      <span className="flex-1 truncate">{board.title}</span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setDeleteWbId(board.id)
        }}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-red-500"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200 dark:border-gray-800">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Whiteboards
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setNewFolderOpen(true)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
              title="New folder"
            >
              <Folder size={13} />
            </button>
            <button
              onClick={() => setNewBoardOpen(true)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
              title="New whiteboard"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2">
          {/* Folders */}
          {folders.map((folder) => {
            const folderBoards = byFolder.get(folder.id) ?? []
            const expanded = expandedFolders.has(folder.id)
            return (
              <div key={folder.id}>
                <div
                  className="group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => toggleFolder(folder.id)}
                >
                  {expanded ? (
                    <ChevronDown size={12} className="text-gray-400 shrink-0" />
                  ) : (
                    <ChevronRight size={12} className="text-gray-400 shrink-0" />
                  )}
                  <Folder size={13} className="text-gray-500 shrink-0" />
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
                    {folder.name}
                  </span>
                  <span className="text-[10px] text-gray-400">{folderBoards.length}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteFolderId(folder.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
                {expanded && (
                  <div className="ml-4 flex flex-col gap-0.5 mt-0.5 mb-1">
                    {folderBoards.map((b) => (
                      <BoardItem key={b.id} board={b} />
                    ))}
                    <button
                      onClick={() => {
                        setNewBoardFolderId(folder.id)
                        setNewBoardOpen(true)
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <Plus size={11} /> Add board
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {/* Unfiled */}
          {unfiledBoards.length > 0 && (
            <div className="mt-2">
              <p className="px-2 py-1 text-xs text-gray-400 font-medium">Unfiled</p>
              <div className="flex flex-col gap-0.5">
                {unfiledBoards.map((b) => (
                  <BoardItem key={b.id} board={b} />
                ))}
              </div>
            </div>
          )}

          {boards.length === 0 && (
            <p className="text-xs text-gray-400 text-center mt-8 px-4">
              No whiteboards yet.
              <br />
              Click + to create one.
            </p>
          )}
        </div>
      </aside>

      {/* Canvas */}
      <div className="flex-1 min-w-0 bg-gray-50 dark:bg-gray-950">
        {selectedBoard ? (
          <Excalidraw
            key={selectedBoard.id}
            initialData={{
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              elements: (selectedBoard.data as any)?.elements ?? [],
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              appState: { ...(selectedBoard.data as any)?.appState ?? {}, collaborators: [] },
            }}
            onChange={handleExcalidrawChange}
            UIOptions={{ canvasActions: { saveToActiveFile: false, loadScene: false, export: { saveFileToDisk: true } } }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <Layout size={48} className="text-gray-300 dark:text-gray-700" />
            <p className="text-sm text-gray-400">Select or create a whiteboard</p>
            <Button size="sm" variant="secondary" onClick={() => setNewBoardOpen(true)}>
              <Plus size={14} /> New whiteboard
            </Button>
          </div>
        )}
      </div>

      {/* Modals */}
      <Modal open={newFolderOpen} onClose={() => setNewFolderOpen(false)} title="New Folder" size="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (newFolderName.trim()) createFolder.mutate()
          }}
          className="flex flex-col gap-4"
        >
          <Input
            label="Folder name"
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="e.g. Product, Architecture"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setNewFolderOpen(false)}>Cancel</Button>
            <Button size="sm" loading={createFolder.isPending} disabled={!newFolderName.trim()}>Create</Button>
          </div>
        </form>
      </Modal>

      <Modal open={newBoardOpen} onClose={() => setNewBoardOpen(false)} title="New Whiteboard" size="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (newBoardName.trim()) createBoard.mutate()
          }}
          className="flex flex-col gap-4"
        >
          <Input
            label="Board title"
            autoFocus
            value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value)}
            placeholder="e.g. System Design"
          />
          {folders.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Folder (optional)</label>
              <select
                value={newBoardFolderId ?? ''}
                onChange={(e) => setNewBoardFolderId(e.target.value || undefined)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100 outline-none"
              >
                <option value="">Unfiled</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setNewBoardOpen(false)}>Cancel</Button>
            <Button size="sm" loading={createBoard.isPending} disabled={!newBoardName.trim()}>Create</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteWbId} onClose={() => setDeleteWbId(null)} title="Delete Whiteboard" size="sm">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">This whiteboard will be permanently deleted.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDeleteWbId(null)}>Cancel</Button>
          <Button variant="danger" size="sm" loading={deleteBoard.isPending} onClick={() => deleteWbId && deleteBoard.mutate(deleteWbId)}>Delete</Button>
        </div>
      </Modal>

      <Modal open={!!deleteFolderId} onClose={() => setDeleteFolderId(null)} title="Delete Folder" size="sm">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Boards in this folder will be moved to <strong>Unfiled</strong>.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDeleteFolderId(null)}>Cancel</Button>
          <Button variant="danger" size="sm" loading={deleteFolder.isPending} onClick={() => deleteFolderId && deleteFolder.mutate(deleteFolderId)}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
