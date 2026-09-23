# Logs Date Navigation Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Daily Logs previous/next-day buttons move exactly one calendar day per click, and stop the Logs page from losing or mis-filing edits while the user changes days.

**Architecture:** Replace the UTC-based date helpers in `Logs.tsx` with small, timezone-independent helpers in `frontend/src/lib/dates.ts`. Then reuse the existing `useDebouncedNoteSave` hook (already fixed for the same class of bug on the Notes page) so autosave is keyed to the date being edited, and fix the editor-sync effect so an empty day never shows the previous day's text.

**Tech Stack:** React 18, TypeScript (strict), Vitest, TanStack Query v5, TipTap.

**Spec:** No separate spec. Root cause found by code reading and reproduced with a Node script (see Background).

## Global Constraints

- No new dependencies.
- `npx tsc --noEmit` and `npx vitest run` must pass before every commit.
- Date strings are always `YYYY-MM-DD` (the backend's `log_date` is a `NaiveDate`, serialized the same way).
- Keep diffs minimal. Do not touch the Notes page or `useDebouncedNoteSave.ts` internals.

---

## Background: root cause

`frontend/src/pages/Logs.tsx` builds date strings with `formatDate(date) = date.toISOString().split('T')[0]`. `toISOString()` returns the **UTC** date, but `navigateDay` builds a **local**-midnight `Date` (`new Date(selectedDate + 'T00:00:00')`). In any timezone ahead of UTC, local midnight is the previous day in UTC, so every round trip through `formatDate` loses one day.

Reproduced with `node` on this machine (UTC+4):

```
left x3 : 2026-09-24 -> 2026-09-22 -> 2026-09-20 -> 2026-09-18   (jumps 2 days)
right x3: 2026-09-20 -> 2026-09-20 -> 2026-09-20 -> 2026-09-20   (never moves)
```

In UTC the same script steps one day correctly, which is why this was not caught earlier. The same helper also computes `today`, so between local midnight and 04:00 the page thinks "today" is yesterday.

Two related defects on the same screen, found by reading `Logs.tsx` (Task 3 fixes them):

1. **Autosave is not bound to the date being edited.** `upsertLog`'s `mutationFn` reads `log` and `selectedDate` from the render in which it fires. Typing and then changing day within 1.5 s saves the text to the wrong day (or creates a log for the wrong day). Same shape as the Notes bug fixed earlier.
2. **Empty days can show the previous day's text.** The editor-sync effect depends on `[selectedDate, log?.id]` and skips while `log === undefined` (loading). When the new day has no log, the query resolves to `null`, `log?.id` stays `undefined`, the effect does not re-run, and the editor keeps the old day's content. The next autosave then files that text under the new date.

---

### Task 1: Timezone-independent date helpers

**Files:**
- Create: `frontend/src/lib/dates.ts`
- Test: `frontend/src/lib/dates.test.ts`

**Interfaces:**
- Produces: `toDateString(d: Date): string` (local calendar date), `todayString(now?: Date): string`, `addDays(dateStr: string, delta: number): string`.

- [ ] **Step 1: Write the failing test**

`frontend/src/lib/dates.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { addDays, toDateString, todayString } from './dates'

describe('addDays', () => {
  it('steps back exactly one day per call', () => {
    expect(addDays('2026-09-24', -1)).toBe('2026-09-23')
    expect(addDays('2026-09-23', -1)).toBe('2026-09-22')
  })

  it('steps forward exactly one day per call', () => {
    expect(addDays('2026-09-20', 1)).toBe('2026-09-21')
    expect(addDays('2026-09-21', 1)).toBe('2026-09-22')
  })

  it('crosses month, year and leap-day boundaries', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
  })
})

describe('toDateString', () => {
  it('returns the local calendar date, not the UTC date', () => {
    expect(toDateString(new Date(2026, 8, 24, 0, 30))).toBe('2026-09-24')
    expect(toDateString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

describe('todayString', () => {
  it('uses the injected clock', () => {
    expect(todayString(new Date(2026, 8, 24, 0, 30))).toBe('2026-09-24')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/dates.test.ts`
Expected: FAIL, `Failed to resolve import "./dates"`.

- [ ] **Step 3: Implement the helpers**

`frontend/src/lib/dates.ts`:
```ts
const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar date as YYYY-MM-DD. Never use toISOString() for this: it is UTC. */
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayString(now: Date = new Date()): string {
  return toDateString(now)
}

/** Pure calendar arithmetic on YYYY-MM-DD strings. Timezone independent. */
export function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const shifted = new Date(Date.UTC(y, m - 1, d + delta))
  return shifted.toISOString().slice(0, 10)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/dates.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/dates.ts frontend/src/lib/dates.test.ts
git commit -m "feat: add timezone-independent date helpers"
```

---

### Task 2: Use the helpers in Logs.tsx (fixes the buttons)

**Files:**
- Modify: `frontend/src/pages/Logs.tsx` (imports, `formatDate`, `today`, `navigateDay`)

**Interfaces:**
- Consumes: `todayString`, `addDays` from Task 1.

- [ ] **Step 1: Edit imports and remove the UTC helper**

Add near the other imports:
```ts
import { addDays, todayString } from '@/lib/dates'
```
Delete the `formatDate` function (lines 13-15). `formatDisplayDate` stays as is: it parses and prints in local time, which is correct.

- [ ] **Step 2: Replace `today` and `navigateDay`**

Change:
```ts
const today = formatDate(new Date())
```
to:
```ts
const today = todayString()
```

Change:
```ts
  const navigateDay = (delta: number) => {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    setSelectedDate(formatDate(d))
  }
```
to:
```ts
  const navigateDay = (delta: number) => {
    setSelectedDate(addDays(selectedDate, delta))
  }
```

- [ ] **Step 3: Type-check and test**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: no type errors, all suites pass.

- [ ] **Step 4: Manual check**

Run `npm run dev`, log in, open `/logs`. Click left 3 times: each click moves exactly one day. Click right 3 times: each click moves one day forward and the right button disables at today.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Logs.tsx
git commit -m "fix: step Logs dates by one local calendar day per click"
```

---

### Task 3: Bind autosave to the edited date and stop stale editor content

**Files:**
- Modify: `frontend/src/pages/Logs.tsx`

**Interfaces:**
- Consumes: `useDebouncedNoteSave(save: (key: string, content: Record<string, unknown>) => void, delayMs?)` from `@/pages/notes/useDebouncedNoteSave`. The hook is generic in behavior; here `key` is the date string. Do not rename or edit it.

- [ ] **Step 1: Import the hook and remove the bare timer**

Add:
```ts
import { useDebouncedNoteSave } from '@/pages/notes/useDebouncedNoteSave'
```
Remove `const saveTimer = useRef<ReturnType<typeof setTimeout>>()` and remove `useRef` from the `react` import if it becomes unused.

- [ ] **Step 2: Rewrite `upsertLog` to take the date explicitly**

Replace the whole `upsertLog` mutation with:
```ts
  const upsertLog = useMutation({
    mutationFn: async ({
      date,
      ...data
    }: {
      date: string
      content?: unknown
      mood_score?: number
    }) => {
      const existing = qc.getQueryData<DailyLog | null>(['log', date])
      if (existing) {
        return logsApi.update(existing.id, data)
      }
      return logsApi.create({ log_date: date, ...data })
    },
    onSuccess: (saved) => {
      qc.setQueryData(['log', saved.log_date], saved)
    },
    onError: () => error('Failed to save log'),
  })

  const { schedule: scheduleSave, flush: flushSave } = useDebouncedNoteSave((date, content) => {
    upsertLog.mutate({ date, content })
  })

  useEffect(() => {
    return () => {
      flushSave()
    }
  }, [selectedDate, flushSave])
```
`upsertLog` must be declared before the `useEditor` call that uses `scheduleSave`; move the block above `useEditor` if needed.

- [ ] **Step 3: Update `onUpdate` and the mood button**

In `useEditor`:
```ts
    onUpdate: ({ editor }) => {
      scheduleSave(selectedDate, editor.getJSON())
    },
```
Mood button:
```tsx
onClick={() => {
  setMoodScore(n)
  upsertLog.mutate({ date: selectedDate, mood_score: n })
}}
```

- [ ] **Step 4: Fix the editor-sync effect**

Replace:
```ts
  useEffect(() => {
    if (editor && log !== undefined) {
      editor.commands.setContent(log?.content ?? '')
      setMoodScore(log?.mood_score ?? undefined)
    }
  }, [selectedDate, log?.id])
```
with:
```ts
  const logLoaded = log !== undefined
  useEffect(() => {
    if (editor && logLoaded) {
      editor.commands.setContent(toEditorContent(log?.content))
      setMoodScore(log?.mood_score ?? undefined)
    }
  }, [selectedDate, logLoaded, log?.id])
```
Add `import { toEditorContent } from '@/lib/tiptapContent'`. The new `logLoaded` dependency makes the effect re-run when a day with no log finishes loading, so the editor clears instead of keeping the previous day's text. `toEditorContent` also guards against invalid stored content.

- [ ] **Step 5: Type-check and test**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: no type errors, all suites pass.

- [ ] **Step 6: Manual check**

1. Type a sentence on today, immediately click the left button. Return to today: the sentence is saved on today, not on yesterday.
2. Go to a day with no log. The editor is empty, not showing the previous day's text.
3. Click a mood emoji on a day with no log: a log is created for that day, and returning to it shows the mood.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Logs.tsx
git commit -m "fix: bind Logs autosave to the edited date and clear stale editor content"
```

---

## Known limits

- Task 3's editor behavior is verified manually. Mounting TipTap under jsdom is unreliable, so only the pure helpers (Task 1) and the already-tested debounce hook have automated tests.
- `getByDate` in `Logs.tsx` swallows every error as "no log". A real server error looks like an empty day. Out of scope here.
- Vitest cannot change the machine timezone on Windows, so Task 1's `toDateString` test only fails against the old UTC code on a machine east of UTC (as here, UTC+4). It passes everywhere with the new code.
