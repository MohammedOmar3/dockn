// ── Shared ────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  first_name: string
  last_name: string
  email: string
  created_at: string
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Task {
  id: string
  user_id: string
  title: string
  description?: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  created_at: string
  updated_at: string
  tags?: Tag[]
}

export interface CreateTaskDto {
  title: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  due_date?: string | null
}

export interface UpdateTaskDto {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  due_date?: string | null
  clear_due_date?: boolean
}

// ── Daily Logs ────────────────────────────────────────────────────────────────

export interface DailyLog {
  id: string
  user_id: string
  log_date: string
  content: unknown
  mood_score?: number | null
  created_at: string
  updated_at: string
}

export interface CreateDailyLogDto {
  log_date: string
  content?: unknown
  mood_score?: number
}

export interface UpdateDailyLogDto {
  content?: unknown
  mood_score?: number
}

// ── Notebooks ─────────────────────────────────────────────────────────────────

export interface Notebook {
  id: string
  user_id: string
  name: string
  color: string
  display_order: number
  is_inbox: boolean
  created_at: string
  updated_at: string
}

export interface CreateNotebookDto {
  name: string
  color?: string
}

export interface UpdateNotebookDto {
  name?: string
  color?: string
  display_order?: number
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export interface Note {
  id: string
  user_id: string
  notebook_id: string
  title: string
  content: Record<string, unknown>
  display_order: number
  created_at: string
  updated_at: string
}

export interface CreateNoteDto {
  notebook_id: string
  title?: string
  content?: Record<string, unknown>
}

export interface UpdateNoteDto {
  title?: string
  content?: Record<string, unknown>
  notebook_id?: string
  display_order?: number
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export interface Tag {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export interface CreateTagDto {
  name: string
  color?: string
}

export interface UpdateTagDto {
  name?: string
  color?: string
}

// ── Whiteboards ───────────────────────────────────────────────────────────────

export interface WhiteboardFolder {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
}

export interface Whiteboard {
  id: string
  user_id: string
  folder_id: string | null
  title: string
  raw_data: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateWhiteboardDto {
  title?: string
  folder_id?: string | null
  raw_data?: Record<string, unknown>
}

export interface UpdateWhiteboardDto {
  title?: string
  folder_id?: string | null
  raw_data?: Record<string, unknown>
}

// ── Activity ──────────────────────────────────────────────────────────────────

export interface Activity {
  id: string
  user_id: string
  activity_type: string
  entity_id: string | null
  entity_type: string
  description: string
  timestamp: string
}

// ── Search ────────────────────────────────────────────────────────────────────

export interface SearchResults {
  tasks: Array<{ id: string; title: string; status: string }>
  notes: Array<{ id: string; title: string; notebook_id: string }>
  logs: Array<{ id: string; log_date: string; content_snippet: string }>
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface RegisterDto {
  first_name: string
  last_name: string
  email: string
  password: string
}

export interface LoginDto {
  email: string
  password: string
}

export interface AuthResponse {
  user: User
}
