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
