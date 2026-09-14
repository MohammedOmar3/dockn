# Notes & Notebooks Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four confirmed root-cause bugs in the Notes/Notebooks feature that cause silently lost edits, malformed note content, and a dead "open note from search" action.

**Architecture:** No new subsystems. Each fix is scoped to the exact file(s) where the root cause lives: a Rust default-value helper (backend), a small framework-agnostic debounce/flush hook (frontend), an atomic Zustand action (frontend state), and two call-site wiring changes (frontend). A missing test-infra file is fixed first because it currently blocks every frontend test from running.

**Tech Stack:** Rust/Axum/sqlx (backend), React/TypeScript/Vite/Vitest/@testing-library/react/Zustand/TanStack Query/TipTap (frontend).

**Spec:** No separate spec document. This plan is the output of a `superpowers:systematic-debugging` investigation (Phase 1–2: root cause found by reading code and tracing data/control flow, confirmed against library source in `node_modules` and live `vitest` runs — no fix was proposed before a root cause was pinned down). The investigation findings are summarized in each task's "Root cause" note below.

## Global Constraints

- Follow existing patterns: Axum handlers return `AppResult<T>`, frontend API calls go through `frontend/src/api/client.ts` typed wrappers — never call `fetch` directly from components.
- Do not run `cargo sqlx prepare` unless a task actually changes SQL query text (none of these tasks do — verify before skipping).
- Do not add new dependencies; every fix uses libraries already in `Cargo.toml` / `package.json`.
- Every frontend task must leave `npx vitest run` fully green (no failing or skipped suites) before its commit.
- Keep diffs minimal — no unrelated refactoring, no renaming beyond what's specified in a task.

---

## Background: confirmed root causes

1. **Lost edits when switching notes quickly ("saving" bug).** In `frontend/src/pages/Notes.tsx`, the TipTap `onUpdate` handler debounces a save with a bare `setTimeout`, and the `updateNote` mutation resolves the note id from the ambient `selectedNoteId` render variable at the *moment the timer fires*, not the moment the edit happened. If the user types in Note A and switches to Note B before the 1.5s debounce elapses, three things happen almost immediately: the "sync editor" effect calls `editor.commands.setContent(NoteB.content)` (so `editor.getJSON()` at fire-time returns Note B's content, not Note A's edit), and the pending timer's `updateNote.mutate({...})` call resolves `selectedNoteId` to Note B's id (because React Query's `mutate` reads the mutation's *current* `mutationFn`, not the one captured when the timer was scheduled). Net effect: Note A's typed edit is **silently discarded**, and Note B gets a redundant self-save. Nothing clears or flushes the timer when `selectedNoteId` changes — only a *new* keystroke clears it (`clearTimeout(saveTimer.current)` runs inside `onUpdate` itself).
2. **New notes have invalid content ("formatting" bug).** Every new note is created with `content: {}` — both the frontend default (`notesApi.create({ ..., content: {} })` in `Notes.tsx`) and the backend default (`body.content.unwrap_or(serde_json::json!({}))` in `backend/src/routes/notes.rs:132`). `{}` is not a valid ProseMirror document (missing `type: "doc"`). Verified against `@tiptap/core`'s `createNodeFromContent` (`node_modules/@tiptap/core/dist/index.js:1984-2003`): when `schema.nodeFromJSON({})` throws, TipTap catches it, prints a `console.warn('[tiptap warn]: Invalid content...')`, and silently falls back to an empty document — with **no user-visible error**. This means any note whose content is ever invalid (from this default, or from a future bug) renders as a blank editor with zero indication anything is wrong, and the next autosave will happily persist that blank content over whatever was there.
3. **Clicking a note in global search does nothing ("fetching" bug).** `frontend/src/components/ui/SearchModal.tsx`'s note-result `onClick` only calls `navigate('/notes')` — it never sets `selectedNotebookId`/`selectedNoteId` in `useUIStore`, even though the search API (`backend/src/routes/search.rs` `NoteResult`) already returns `notebook_id` for exactly this purpose. The user lands on `/notes` looking at whatever was already open, not the note they searched for.
4. **A footgun that already shipped one bug.** `useUIStore.setSelectedNotebook` (`frontend/src/store/uiStore.ts:38-39`) has a hidden side effect: it always resets `selectedNoteId` to `null`. Every call site that wants to select a specific note in a specific notebook must call `setSelectedNotebook(nbId)` *before* `setSelectedNoteId(noteId)`, or the second call gets silently wiped. Commit `0a2a9a4` ("bug fix on notes selection") already fixed one instance of this ordering bug in the tree-item click handler. It is still one call away from happening again anywhere a new "open this note" entry point is added (as in bug #3 above) — this plan removes the footgun instead of adding a fourth "remember the right order" call site.

**What's intentionally out of scope:** the same debounce-without-flush pattern exists in `frontend/src/pages/Logs.tsx` (daily logs autosave). It has the same bug shape but the user only reported Notes/Notebooks, and fixing it is a separate, independently testable change — call it out to the user as a known follow-up, don't fix it in this plan.

---

### Task 1: Fix missing frontend test setup file

**Files:**
- Create: `frontend/src/test/setup.ts`

**Interfaces:**
- Produces: a file that satisfies `frontend/vite.config.ts`'s existing `test.setupFiles: ['./src/test/setup.ts']` entry. No exports needed — Vitest just needs the module to exist and run.

**Root cause:** `vite.config.ts` already references `./src/test/setup.ts` for every test run, but the file was never created. Confirmed by running `npx vitest run` against a throwaway test file — it fails immediately with `Error: Failed to load url .../src/test/setup.ts (resolved id: .../src/test/setup.ts). Does the file exist?`. Every later task in this plan adds real tests, so this must be fixed first or every subsequent `npx vitest run` will fail for an unrelated reason.

- [ ] **Step 1: Confirm the failure exists**

Run:
```bash
cd frontend
mkdir -p src/__scratch__
cat > src/__scratch__/tmp.test.ts << 'EOF'
import { describe, it, expect } from 'vitest'
describe('tmp', () => { it('works', () => { expect(1).toBe(1) }) })
EOF
npx vitest run
```
Expected: FAIL with `Failed to load url .../src/test/setup.ts`.

- [ ] **Step 2: Create the setup file**

`frontend/src/test/setup.ts`:
```ts
import '@testing-library/react'
```

(`@testing-library/react` v16 registers an `afterEach(cleanup)` automatically when it detects Vitest's `globals: true` test environment — which `vite.config.ts` already sets — so no explicit `afterEach(cleanup)` call or extra dependency is needed here.)

- [ ] **Step 3: Verify the scratch test now passes**

Run: `npx vitest run`
Expected: PASS (`src/__scratch__/tmp.test.ts` — 1 passed).

- [ ] **Step 4: Remove the scratch test**

```bash
rm -rf src/__scratch__
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/test/setup.ts
git commit -m "fix: add missing vitest setup file so frontend tests can run"
```

---

### Task 2: Fix invalid empty-note content (backend default)

**Files:**
- Modify: `backend/src/models/note.rs`
- Modify: `backend/src/routes/notes.rs:132`
- Test: `backend/src/models/note.rs` (inline `#[cfg(test)]` module)

**Interfaces:**
- Produces: `pub fn empty_note_content() -> serde_json::Value` in `backend/src/models/note.rs`, returning a valid minimal ProseMirror/TipTap document: `{"type":"doc","content":[{"type":"paragraph"}]}`.
- Consumed by: `backend/src/routes/notes.rs`'s `create_note` handler (replaces `serde_json::json!({})`).

**Root cause:** see Background #2. The SQL text in `create_note` is unchanged (still `INSERT INTO notes (...) VALUES ($1,$2,$3,$4,$5) RETURNING *`) — only the Rust-side fallback value changes — so **no `cargo sqlx prepare` is needed**.

- [ ] **Step 1: Write the failing test**

Add to the bottom of `backend/src/models/note.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_note_content_is_a_valid_prosemirror_doc() {
        let content = empty_note_content();
        assert_eq!(content["type"], "doc");
        let children = content["content"].as_array().expect("content must be an array");
        assert!(!children.is_empty(), "an empty array content is not a valid ProseMirror doc");
        assert_eq!(children[0]["type"], "paragraph");
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && cargo test empty_note_content_is_a_valid_prosemirror_doc`
Expected: FAIL with `cannot find function 'empty_note_content' in this scope` (compile error).

- [ ] **Step 3: Implement the helper**

Add to `backend/src/models/note.rs`, above the `#[cfg(test)]` module:
```rust
/// A valid empty ProseMirror/TipTap document — `{}` is NOT valid (it has no
/// `type: "doc"`), and TipTap silently discards invalid content on load,
/// which previously made every new note render as a blank, unrecoverable editor.
pub fn empty_note_content() -> Value {
    serde_json::json!({
        "type": "doc",
        "content": [{ "type": "paragraph" }]
    })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && cargo test empty_note_content_is_a_valid_prosemirror_doc`
Expected: PASS.

- [ ] **Step 5: Wire the helper into `create_note`**

In `backend/src/routes/notes.rs`, change line 132 from:
```rust
        body.content.unwrap_or(serde_json::json!({})),
```
to:
```rust
        body.content.unwrap_or_else(crate::models::note::empty_note_content),
```

- [ ] **Step 6: Verify the backend builds**

Run: `cd backend && cargo check`
Expected: no errors (this requires either a reachable `DATABASE_URL` or `SQLX_OFFLINE=true` — the query text is unchanged so the committed `.sqlx/` cache is still valid; run `SQLX_OFFLINE=true cargo check` if no local Postgres is running).

- [ ] **Step 7: Commit**

```bash
git add backend/src/models/note.rs backend/src/routes/notes.rs
git commit -m "fix: default new note content to a valid ProseMirror doc instead of {}"
```

---

### Task 3: Fix invalid empty-note content (frontend create default)

**Files:**
- Create: `frontend/src/lib/tiptapContent.ts`
- Modify: `frontend/src/pages/Notes.tsx` (the `createNote` mutation, around line 350)
- Test: `frontend/src/lib/tiptapContent.test.ts`

**Interfaces:**
- Produces: `export const EMPTY_NOTE_CONTENT: { type: 'doc'; content: [{ type: 'paragraph' }] }` in `frontend/src/lib/tiptapContent.ts`.
- Consumed by: `Notes.tsx`'s `createNote` mutation (replaces the `content: {}` literal).

**Root cause:** see Background #2. This mirrors Task 2 on the frontend: the "New note" button (`onAddNote` → `createNote.mutate(notebookId)`) sends `content: {}` in the create request. Even after Task 2 fixes the *backend's* fallback, this call still explicitly overrides it with `{}`, so Task 2 alone would not fix the bug for notes created through the UI (the backend default only kicks in when `content` is omitted entirely, and this call sends it explicitly).

- [ ] **Step 1: Write the failing test**

`frontend/src/lib/tiptapContent.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { EMPTY_NOTE_CONTENT } from './tiptapContent'

describe('EMPTY_NOTE_CONTENT', () => {
  it('is a valid, non-empty ProseMirror document', () => {
    expect(EMPTY_NOTE_CONTENT.type).toBe('doc')
    expect(EMPTY_NOTE_CONTENT.content.length).toBeGreaterThan(0)
    expect(EMPTY_NOTE_CONTENT.content[0].type).toBe('paragraph')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/tiptapContent.test.ts`
Expected: FAIL — `Failed to resolve import "./tiptapContent"`.

- [ ] **Step 3: Implement the constant**

`frontend/src/lib/tiptapContent.ts`:
```ts
/**
 * A valid empty ProseMirror/TipTap document. `{}` is NOT valid — TipTap
 * silently discards it and falls back to a blank editor with only a
 * console.warn, masking the failure. Use this for every "new, empty note"
 * content default instead.
 */
export const EMPTY_NOTE_CONTENT = {
  type: 'doc' as const,
  content: [{ type: 'paragraph' as const }],
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/tiptapContent.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the constant into `Notes.tsx`**

In `frontend/src/pages/Notes.tsx`, add the import near the top:
```ts
import { EMPTY_NOTE_CONTENT } from '@/lib/tiptapContent'
```

Change the `createNote` mutation's `mutationFn` from:
```ts
    mutationFn: (notebookId: string) =>
      notesApi.create({ title: 'Untitled', notebook_id: notebookId, content: {} }),
```
to:
```ts
    mutationFn: (notebookId: string) =>
      notesApi.create({ title: 'Untitled', notebook_id: notebookId, content: EMPTY_NOTE_CONTENT }),
```

- [ ] **Step 6: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: all suites pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/tiptapContent.ts frontend/src/lib/tiptapContent.test.ts frontend/src/pages/Notes.tsx
git commit -m "fix: send a valid ProseMirror doc when creating a new note from the UI"
```

---

### Task 4: Fix lost edits when switching notes before autosave fires

**Files:**
- Create: `frontend/src/pages/notes/useDebouncedNoteSave.ts`
- Create: `frontend/src/pages/notes/useDebouncedNoteSave.test.ts`
- Modify: `frontend/src/pages/Notes.tsx`

**Interfaces:**
- Produces: `useDebouncedNoteSave(save: (noteId: string, content: Record<string, unknown>) => void, delayMs?: number): { schedule: (noteId: string, content: Record<string, unknown>) => void; flush: () => void }` in `frontend/src/pages/notes/useDebouncedNoteSave.ts`.
- Consumed by: `Notes.tsx`'s TipTap `onUpdate` handler (calls `schedule`) and a new cleanup effect keyed on `selectedNoteId` (calls `flush`).

**Root cause:** see Background #1. The fix is deliberately isolated into a small, TipTap-free hook so it can be unit-tested directly with fake timers — mounting a real TipTap/ProseMirror editor under `jsdom` to drive this through keystrokes is unreliable (`contentEditable`/selection APIs are not fully implemented in `jsdom`), so the pure scheduling/flushing logic is extracted and tested on its own, then wired into `Notes.tsx` with a two-line change.

- [ ] **Step 1: Write the failing test**

`frontend/src/pages/notes/useDebouncedNoteSave.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebouncedNoteSave } from './useDebouncedNoteSave'

describe('useDebouncedNoteSave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('saves the scheduled note id and content after the delay elapses', () => {
    const save = vi.fn()
    const { result } = renderHook(() => useDebouncedNoteSave(save, 1500))

    act(() => {
      result.current.schedule('note-a', { text: 'hello' })
    })
    expect(save).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('note-a', { text: 'hello' })
  })

  it('does not lose an edit when the note is switched before the delay elapses', () => {
    const save = vi.fn()
    const { result } = renderHook(() => useDebouncedNoteSave(save, 1500))

    // User types in note-a...
    act(() => {
      result.current.schedule('note-a', { text: 'edit to note-a' })
    })

    // ...then switches to note-b after only 500ms — the app must flush
    // the pending note-a save instead of letting the timer fire against
    // whatever note is current by then.
    act(() => {
      vi.advanceTimersByTime(500)
      result.current.flush()
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('note-a', { text: 'edit to note-a' })

    // A later edit to note-b still debounces normally.
    act(() => {
      result.current.schedule('note-b', { text: 'edit to note-b' })
      vi.advanceTimersByTime(1500)
    })
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith('note-b', { text: 'edit to note-b' })
  })

  it('flush is a no-op when there is nothing pending', () => {
    const save = vi.fn()
    const { result } = renderHook(() => useDebouncedNoteSave(save, 1500))

    act(() => {
      result.current.flush()
    })

    expect(save).not.toHaveBeenCalled()
  })

  it('a second schedule call before the delay elapses replaces the pending save (no duplicate saves)', () => {
    const save = vi.fn()
    const { result } = renderHook(() => useDebouncedNoteSave(save, 1500))

    act(() => {
      result.current.schedule('note-a', { text: 'first draft' })
      vi.advanceTimersByTime(500)
      result.current.schedule('note-a', { text: 'second draft' })
      vi.advanceTimersByTime(1500)
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('note-a', { text: 'second draft' })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/notes/useDebouncedNoteSave.test.ts`
Expected: FAIL — `Failed to resolve import "./useDebouncedNoteSave"`.

- [ ] **Step 3: Implement the hook**

`frontend/src/pages/notes/useDebouncedNoteSave.ts`:
```ts
import { useCallback, useRef } from 'react'

interface PendingSave {
  noteId: string
  content: Record<string, unknown>
}

/**
 * Debounces note-content saves, keyed to the specific note id an edit
 * belongs to (not to whatever note happens to be selected when the timer
 * fires). Call `flush()` whenever the user navigates away from the note
 * being edited (switching notes/notebooks, unmounting the editor) so a
 * pending edit is saved immediately instead of silently dropped or
 * mis-attributed to whatever note is selected by the time the timer fires.
 */
export function useDebouncedNoteSave(
  save: (noteId: string, content: Record<string, unknown>) => void,
  delayMs = 1500,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const pendingRef = useRef<PendingSave | null>(null)

  const flush = useCallback(() => {
    clearTimeout(timerRef.current)
    const pending = pendingRef.current
    if (pending) {
      pendingRef.current = null
      save(pending.noteId, pending.content)
    }
  }, [save])

  const schedule = useCallback(
    (noteId: string, content: Record<string, unknown>) => {
      pendingRef.current = { noteId, content }
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(flush, delayMs)
    },
    [flush, delayMs],
  )

  return { schedule, flush }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/notes/useDebouncedNoteSave.test.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Wire the hook into `Notes.tsx`**

In `frontend/src/pages/Notes.tsx`:

Add the import near the top:
```ts
import { useDebouncedNoteSave } from '@/pages/notes/useDebouncedNoteSave'
```

Remove the now-unused ref (it moves inside the hook):
```ts
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
```

Change the `updateNote` mutation from:
```ts
  const updateNote = useMutation({
    mutationFn: (data: { title?: string; content?: Record<string, unknown> }) =>
      notesApi.update(selectedNoteId!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', selectedNotebookId] }),
  })
```
to:
```ts
  const updateNote = useMutation({
    mutationFn: ({ noteId, ...data }: { noteId: string; title?: string; content?: Record<string, unknown> }) =>
      notesApi.update(noteId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', selectedNotebookId] }),
  })

  const { schedule: scheduleSave, flush: flushSave } = useDebouncedNoteSave((noteId, content) => {
    updateNote.mutate({ noteId, content })
  })

  // Flush any pending autosave for the note being left, so a switch away
  // never silently drops the last edit (see useDebouncedNoteSave.ts).
  useEffect(() => {
    return () => {
      flushSave()
    }
  }, [selectedNoteId, flushSave])
```

Change the `useEditor`'s `onUpdate` from:
```ts
    onUpdate: ({ editor }) => {
      if (!selectedNoteId) return
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        updateNote.mutate({ content: editor.getJSON() })
      }, 1500)
    },
```
to:
```ts
    onUpdate: ({ editor }) => {
      if (!selectedNoteId) return
      scheduleSave(selectedNoteId, editor.getJSON())
    },
```

Update `handleTitleBlur` (the mutation payload now requires `noteId`) from:
```ts
  const handleTitleBlur = useCallback(() => {
    if (selectedNoteId && noteTitleEdit.trim() && noteTitleEdit !== selectedNote?.title) {
      updateNote.mutate({ title: noteTitleEdit.trim() })
    }
  }, [selectedNoteId, noteTitleEdit, selectedNote?.title])
```
to:
```ts
  const handleTitleBlur = useCallback(() => {
    if (selectedNoteId && noteTitleEdit.trim() && noteTitleEdit !== selectedNote?.title) {
      updateNote.mutate({ noteId: selectedNoteId, title: noteTitleEdit.trim() })
    }
  }, [selectedNoteId, noteTitleEdit, selectedNote?.title, updateNote])
```

- [ ] **Step 6: Type-check and run the full frontend suite**

Run:
```bash
cd frontend
npx tsc --noEmit
npx vitest run
```
Expected: no type errors, all suites pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/notes/useDebouncedNoteSave.ts frontend/src/pages/notes/useDebouncedNoteSave.test.ts frontend/src/pages/Notes.tsx
git commit -m "fix: flush pending note autosave when switching notes so edits aren't dropped"
```

---

### Task 5: Add an atomic "select notebook + note" store action

**Files:**
- Modify: `frontend/src/store/uiStore.ts`
- Test: `frontend/src/store/uiStore.test.ts`

**Interfaces:**
- Produces: `selectNote: (notebookId: string, noteId: string | null) => void` on the `UIState` interface and store, alongside the existing `setSelectedNotebook`/`setSelectedNote`.
- Consumed by: Task 6 (`SearchModal.tsx`) and used to replace the two-call pattern in `Notes.tsx` wherever a specific note is being opened in a specific notebook.

**Root cause:** see Background #4. `setSelectedNotebook` always resets `selectedNoteId` to `null` as a side effect, so any call site that wants "select this notebook AND this note" must call the two setters in the exact right order — a footgun that already caused one shipped bug (commit `0a2a9a4`) and would otherwise need a fourth carefully-ordered call site in Task 6. This task adds one atomic action so no call site has to get the ordering right by hand.

- [ ] **Step 1: Write the failing test**

`frontend/src/store/uiStore.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from './uiStore'

describe('useUIStore.selectNote', () => {
  beforeEach(() => {
    useUIStore.setState({ selectedNotebookId: null, selectedNoteId: null })
  })

  it('sets notebook and note together in one call', () => {
    useUIStore.getState().selectNote('nb-1', 'note-1')

    const state = useUIStore.getState()
    expect(state.selectedNotebookId).toBe('nb-1')
    expect(state.selectedNoteId).toBe('note-1')
  })

  it('can select a notebook with no note selected', () => {
    useUIStore.getState().selectNote('nb-2', null)

    const state = useUIStore.getState()
    expect(state.selectedNotebookId).toBe('nb-2')
    expect(state.selectedNoteId).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/store/uiStore.test.ts`
Expected: FAIL — `useUIStore.getState().selectNote is not a function`.

- [ ] **Step 3: Implement the action**

In `frontend/src/store/uiStore.ts`, add to the `UIState` interface (near the other actions):
```ts
  selectNote: (notebookId: string, noteId: string | null) => void
```

Add to the store implementation (near `setSelectedNotebook`):
```ts
      selectNote: (notebookId: string, noteId: string | null) =>
        set({ selectedNotebookId: notebookId, selectedNoteId: noteId }),
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/store/uiStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/store/uiStore.ts frontend/src/store/uiStore.test.ts
git commit -m "feat: add atomic selectNote store action to remove notebook/note selection ordering footgun"
```

---

### Task 6: Fix "open note from search" and remove the remaining ordering footguns

**Files:**
- Modify: `frontend/src/components/ui/SearchModal.tsx`
- Modify: `frontend/src/pages/Notes.tsx`
- Test: `frontend/src/components/ui/SearchModal.test.tsx`

**Interfaces:**
- Consumes: `useUIStore().selectNote` from Task 5.

**Root cause:** see Background #3 and #4. `SearchModal`'s note click handler never selects the note at all (Background #3). Separately, now that `selectNote` exists (Task 5), the two remaining two-call `setSelectedNotebookId(...)` / `setSelectedNoteId(...)` sequences in `Notes.tsx` (the tree-item click handler and the `createNote` success handler) are replaced with the atomic action so the ordering footgun from Background #4 can't resurface at any of these call sites.

- [ ] **Step 1: Write the failing test**

`frontend/src/components/ui/SearchModal.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { SearchModal } from './SearchModal'
import { useUIStore } from '@/store/uiStore'
import { searchApi } from '@/api/client'

vi.mock('@/api/client', () => ({
  searchApi: { search: vi.fn() },
}))

function renderModal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SearchModal />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SearchModal note selection', () => {
  beforeEach(() => {
    useUIStore.setState({
      searchOpen: true,
      selectedNotebookId: null,
      selectedNoteId: null,
    })
    vi.mocked(searchApi.search).mockResolvedValue({
      tasks: [],
      notes: [{ id: 'note-42', title: 'Roadmap draft', notebook_id: 'nb-7' }],
      logs: [],
    })
  })

  it('selects the clicked note and its notebook, not just navigating', async () => {
    renderModal()

    fireEvent.change(screen.getByPlaceholderText(/Search tasks, notes, logs/i), {
      target: { value: 'roadmap' },
    })

    const noteButton = await screen.findByText('Roadmap draft')
    fireEvent.click(noteButton)

    await waitFor(() => {
      expect(useUIStore.getState().selectedNoteId).toBe('note-42')
    })
    expect(useUIStore.getState().selectedNotebookId).toBe('nb-7')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/components/ui/SearchModal.test.tsx`
Expected: FAIL — `selectedNoteId` stays `null` (the click handler never sets it).

- [ ] **Step 3: Fix the search result click handler**

In `frontend/src/components/ui/SearchModal.tsx`, add `selectNote` to the store destructure:
```ts
  const { searchOpen, setSearchOpen, selectNote } = useUIStore()
```

Change the notes section's button `onClick` from:
```tsx
                    onClick={() => {
                      navigate('/notes')
                      setSearchOpen(false)
                    }}
```
to:
```tsx
                    onClick={() => {
                      selectNote(note.notebook_id, note.id)
                      navigate('/notes')
                      setSearchOpen(false)
                    }}
```

(This is inside the `data.notes.map((note) => ...)` block — `note.notebook_id` is already part of `SearchResults['notes']`, see `frontend/src/types/index.ts`.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/components/ui/SearchModal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Replace the remaining two-call sequences in `Notes.tsx`**

In `frontend/src/pages/Notes.tsx`, change the tree-item click handler from:
```tsx
              onSelectNote={(note, notebookId) => {
                setSelectedNotebookId(notebookId)
                setSelectedNoteId(note.id)
              }}
```
to:
```tsx
              onSelectNote={(note, notebookId) => {
                selectNote(notebookId, note.id)
              }}
```

Change the `createNote` mutation's `onSuccess` from:
```ts
    onSuccess: (note, notebookId) => {
      qc.setQueryData<Note[]>(['notes', notebookId], (current = []) => upsertNote(current, note))
      qc.invalidateQueries({ queryKey: ['notes', notebookId] })
      setSelectedNotebookId(notebookId)
      setSelectedNoteId(note.id)
      success('Note created')
    },
```
to:
```ts
    onSuccess: (note, notebookId) => {
      qc.setQueryData<Note[]>(['notes', notebookId], (current = []) => upsertNote(current, note))
      qc.invalidateQueries({ queryKey: ['notes', notebookId] })
      selectNote(notebookId, note.id)
      success('Note created')
    },
```

Update the store destructure at the top of the component from:
```ts
  const { selectedNotebookId, setSelectedNotebook: setSelectedNotebookId, selectedNoteId, setSelectedNote: setSelectedNoteId } = useUIStore()
```
to:
```ts
  const { selectedNotebookId, setSelectedNotebook: setSelectedNotebookId, selectedNoteId, setSelectedNote: setSelectedNoteId, selectNote } = useUIStore()
```

(`setSelectedNotebookId`/`setSelectedNoteId` are still used elsewhere in the file — the initial auto-select effect and `deleteNote`'s `onSuccess` — so keep those two destructured names; only the two call sites above change to `selectNote`.)

- [ ] **Step 6: Type-check and run the full frontend suite**

Run:
```bash
cd frontend
npx tsc --noEmit
npx vitest run
```
Expected: no type errors, all suites pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/ui/SearchModal.tsx frontend/src/components/ui/SearchModal.test.tsx frontend/src/pages/Notes.tsx
git commit -m "fix: open the correct note when selecting a search result"
```

---

## Final verification (run after all tasks)

- [ ] **Backend:** `cd backend && cargo test && cargo check`
- [ ] **Frontend:** `cd frontend && npx tsc --noEmit && npx vitest run && npm run lint`
- [ ] **Manual smoke test** (per README's "Local development" steps — start Postgres, run migrations, `cargo run`, `npm run dev`):
  1. Create a notebook — confirm it appears expanded in the sidebar immediately.
  2. Create a note in it — confirm the editor shows an empty, formattable editor (not a console warning, not visibly "broken").
  3. Type a sentence, then *immediately* (within ~1 second) click a different note, then click back — confirm the sentence was saved (this is the regression test for Background #1; it could not be reproduced before this plan without a live TipTap editor in a real browser).
  4. Open the global search (Cmd/Ctrl+K), search for the note's title, click the result — confirm it opens that exact note, not whatever was previously open.

## Known follow-up (explicitly out of scope for this plan)

`frontend/src/pages/Logs.tsx` has the same debounce-without-flush shape as Background #1 (its `onUpdate` also uses a bare `setTimeout` + `upsertLog.mutate` without flushing on `selectedDate` change). It was not included here because the user's report was scoped to Notes/Notebooks; if daily-log edit loss is also observed, apply the same `useDebouncedNoteSave`-style fix there (it would need a minor generalization since `Logs.tsx` keys by `log_date` string rather than a note `id`, and creates the log lazily on first save if it doesn't exist yet).
