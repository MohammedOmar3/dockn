import { describe, it, expect } from 'vitest'
import { EMPTY_NOTE_CONTENT, toEditorContent } from './tiptapContent'

describe('EMPTY_NOTE_CONTENT', () => {
  it('is a valid, non-empty ProseMirror document', () => {
    expect(EMPTY_NOTE_CONTENT.type).toBe('doc')
    expect(EMPTY_NOTE_CONTENT.content.length).toBeGreaterThan(0)
    expect(EMPTY_NOTE_CONTENT.content[0].type).toBe('paragraph')
  })
})

describe('toEditorContent', () => {
  it('returns the content unchanged when it is already a valid doc', () => {
    const validDoc = { type: 'doc', content: [{ type: 'paragraph' }] }
    expect(toEditorContent(validDoc)).toBe(validDoc)
  })

  it('falls back to EMPTY_NOTE_CONTENT for {}', () => {
    expect(toEditorContent({})).toEqual(EMPTY_NOTE_CONTENT)
  })

  it('falls back to EMPTY_NOTE_CONTENT for null/undefined', () => {
    expect(toEditorContent(null)).toEqual(EMPTY_NOTE_CONTENT)
    expect(toEditorContent(undefined)).toEqual(EMPTY_NOTE_CONTENT)
  })
})
