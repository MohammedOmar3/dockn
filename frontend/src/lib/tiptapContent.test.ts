import { describe, it, expect } from 'vitest'
import { EMPTY_NOTE_CONTENT } from './tiptapContent'

describe('EMPTY_NOTE_CONTENT', () => {
  it('is a valid, non-empty ProseMirror document', () => {
    expect(EMPTY_NOTE_CONTENT.type).toBe('doc')
    expect(EMPTY_NOTE_CONTENT.content.length).toBeGreaterThan(0)
    expect(EMPTY_NOTE_CONTENT.content[0].type).toBe('paragraph')
  })
})
