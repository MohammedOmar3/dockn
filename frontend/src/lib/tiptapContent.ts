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

/**
 * Normalizes a note's raw stored `content` for handing to TipTap. Notes
 * persisted (or still lingering in the DB) with invalid content such as
 * `{}` render as a blank, unrecoverable editor with only a console.warn —
 * fall back to a valid empty document instead of passing that straight
 * through.
 */
export function toEditorContent(content: unknown): Record<string, unknown> {
  if (content && typeof content === 'object' && (content as Record<string, unknown>).type === 'doc') {
    return content as Record<string, unknown>
  }
  return EMPTY_NOTE_CONTENT
}
