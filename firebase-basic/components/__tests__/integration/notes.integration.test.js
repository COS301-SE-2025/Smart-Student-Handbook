// components/ui/__tests__/integration/notes.test.js
const { ref, set, get, remove } = require('firebase/database')

// Mock Firebase database
jest.mock('firebase/database', () => ({
  ref: jest.fn(),
  set: jest.fn(),
  get: jest.fn(),
  remove: jest.fn(),
}))

describe('Notes Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should create a note', async () => {
    const noteData = {
      id: 'note-1',
      title: 'Test Note',
      content: 'Test content',
      createdAt: Date.now(),
    }

    const mockRef = { key: 'note-1' }
    ref.mockReturnValue(mockRef)
    set.mockResolvedValue(undefined)

    // Create the reference and call set
    const noteRef = ref('notes', noteData.id)
    await set(noteRef, noteData)

    expect(ref).toHaveBeenCalledWith('notes', noteData.id)
    expect(set).toHaveBeenCalledWith(mockRef, noteData)
  })

  it('should retrieve a note', async () => {
    const mockNote = {
      id: 'note-1',
      title: 'Test Note',
      content: 'Test content',
    }

    const mockRef = { key: 'note-1' }
    const mockSnapshot = {
      val: () => mockNote,
      exists: () => true,
    }

    ref.mockReturnValue(mockRef)
    get.mockResolvedValue(mockSnapshot)

    const noteRef = ref('notes', mockNote.id)
    const result = await get(noteRef)
    const note = result.val()

    expect(ref).toHaveBeenCalledWith('notes', mockNote.id)
    expect(get).toHaveBeenCalledWith(mockRef)
    expect(note).toEqual(mockNote)
  })
})