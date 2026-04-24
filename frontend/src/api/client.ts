const API_BASE = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

let isRefreshing = false
let refreshPromise: Promise<void> | null = null

async function refreshToken(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) {
    throw new ApiError(res.status, 'Session expired')
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (res.status === 401 && retry) {
    // Deduplicate concurrent refresh calls
    if (!isRefreshing) {
      isRefreshing = true
      refreshPromise = refreshToken().finally(() => {
        isRefreshing = false
        refreshPromise = null
      })
    }

    try {
      await refreshPromise
      return request<T>(path, options, false)
    } catch {
      // Refresh failed — redirect to login
      window.location.href = '/login'
      throw new ApiError(401, 'Session expired')
    }
  }

  if (!res.ok) {
    let message = `Request failed: ${res.status}`
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {}
    throw new ApiError(res.status, message)
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (body: import('@/types').RegisterDto) =>
    request<import('@/types').AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  login: (body: import('@/types').LoginDto) =>
    request<import('@/types').AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  logout: () =>
    request<void>('/api/auth/logout', { method: 'POST' }),

  me: () => request<import('@/types').AuthResponse>('/api/auth/me'),

  updateProfile: (body: { first_name?: string; last_name?: string; email?: string }) =>
    request<import('@/types').User>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  changePassword: (body: { current_password: string; new_password: string }) =>
    request<void>('/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  deleteAccount: (body: { password: string }) =>
    request<void>('/api/auth/account', {
      method: 'DELETE',
      body: JSON.stringify(body),
    }),
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export const tasksApi = {
  list: () => request<import('@/types').Task[]>('/api/tasks'),
  get: (id: string) => request<import('@/types').Task>(`/api/tasks/${id}`),
  create: (body: import('@/types').CreateTaskDto) =>
    request<import('@/types').Task>('/api/tasks', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: import('@/types').UpdateTaskDto) =>
    request<import('@/types').Task>(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) =>
    request<void>(`/api/tasks/${id}`, { method: 'DELETE' }),
  addTag: (taskId: string, tagId: string) =>
    request<void>(`/api/tasks/${taskId}/tags/${tagId}`, { method: 'POST' }),
  removeTag: (taskId: string, tagId: string) =>
    request<void>(`/api/tasks/${taskId}/tags/${tagId}`, { method: 'DELETE' }),
}

// ── Daily Logs ────────────────────────────────────────────────────────────────

export const logsApi = {
  list: () => request<import('@/types').DailyLog[]>('/api/daily-logs'),
  getByDate: (date: string) => request<import('@/types').DailyLog>(`/api/daily-logs/date/${date}`),
  create: (body: import('@/types').CreateDailyLogDto) =>
    request<import('@/types').DailyLog>('/api/daily-logs', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: import('@/types').UpdateDailyLogDto) =>
    request<import('@/types').DailyLog>(`/api/daily-logs/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) =>
    request<void>(`/api/daily-logs/${id}`, { method: 'DELETE' }),
}

// ── Notebooks ─────────────────────────────────────────────────────────────────

export const notebooksApi = {
  list: () => request<import('@/types').Notebook[]>('/api/notebooks'),
  get: (id: string) => request<import('@/types').Notebook>(`/api/notebooks/${id}`),
  create: (body: import('@/types').CreateNotebookDto) =>
    request<import('@/types').Notebook>('/api/notebooks', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: import('@/types').UpdateNotebookDto) =>
    request<import('@/types').Notebook>(`/api/notebooks/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) =>
    request<void>(`/api/notebooks/${id}`, { method: 'DELETE' }),
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export const notesApi = {
  list: (notebookId?: string) =>
    request<import('@/types').Note[]>(
      notebookId ? `/api/notes?notebook_id=${notebookId}` : '/api/notes',
    ),
  get: (id: string) => request<import('@/types').Note>(`/api/notes/${id}`),
  create: (body: import('@/types').CreateNoteDto) =>
    request<import('@/types').Note>('/api/notes', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: import('@/types').UpdateNoteDto) =>
    request<import('@/types').Note>(`/api/notes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) =>
    request<void>(`/api/notes/${id}`, { method: 'DELETE' }),
  addTag: (noteId: string, tagId: string) =>
    request<void>(`/api/notes/${noteId}/tags/${tagId}`, { method: 'POST' }),
  removeTag: (noteId: string, tagId: string) =>
    request<void>(`/api/notes/${noteId}/tags/${tagId}`, { method: 'DELETE' }),
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export const tagsApi = {
  list: () => request<import('@/types').Tag[]>('/api/tags'),
  create: (body: import('@/types').CreateTagDto) =>
    request<import('@/types').Tag>('/api/tags', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: import('@/types').UpdateTagDto) =>
    request<import('@/types').Tag>(`/api/tags/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) =>
    request<void>(`/api/tags/${id}`, { method: 'DELETE' }),
}

// ── Whiteboards ────────────────────────────────────────────────────────────────

export const whiteboardsApi = {
  list: () => request<import('@/types').Whiteboard[]>('/api/whiteboards'),
  get: (id: string) => request<import('@/types').Whiteboard>(`/api/whiteboards/${id}`),
  create: (body: import('@/types').CreateWhiteboardDto) =>
    request<import('@/types').Whiteboard>('/api/whiteboards', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: import('@/types').UpdateWhiteboardDto) =>
    request<import('@/types').Whiteboard>(`/api/whiteboards/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) =>
    request<void>(`/api/whiteboards/${id}`, { method: 'DELETE' }),
}

export const foldersApi = {
  list: () => request<import('@/types').WhiteboardFolder[]>('/api/whiteboard-folders'),
  create: (body: { name: string }) =>
    request<import('@/types').WhiteboardFolder>('/api/whiteboard-folders', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: { name: string }) =>
    request<import('@/types').WhiteboardFolder>(`/api/whiteboard-folders/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) =>
    request<void>(`/api/whiteboard-folders/${id}`, { method: 'DELETE' }),
}

// ── Activity ──────────────────────────────────────────────────────────────────

export const activityApi = {
  getByDate: (date: string) =>
    request<import('@/types').Activity[]>(`/api/activity/${date}`),
}

// ── Capture ───────────────────────────────────────────────────────────────────

export const captureApi = {
  capture: (text: string) =>
    request<{ type: 'task' | 'note'; entity: unknown }>('/api/capture', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
}

// ── Search ────────────────────────────────────────────────────────────────────

export const searchApi = {
  search: (q: string, type?: 'all' | 'tasks' | 'notes' | 'logs') =>
    request<import('@/types').SearchResults>(
      `/api/search?q=${encodeURIComponent(q)}${type ? `&type=${type}` : ''}`,
    ),
}
