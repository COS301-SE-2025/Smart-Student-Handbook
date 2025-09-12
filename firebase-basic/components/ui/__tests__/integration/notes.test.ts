// __tests__/integration/notes.test.ts
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { ref, set, get, push, remove } from 'firebase/database'
import { setupFirebaseTest, cleanupFirebaseTest } from '../setup/firebase-test-setup'
import { createTestUser, createTestNote, cleanupTestData } from '../utils/test-helpers'

describe('Notes Integration Tests', () => {
  const { database } = setupFirebaseTest()
  let testUser: any
  let userId: string

  beforeEach(async () => {
    testUser = await createTestUser()
    userId = testUser.uid
  })

  afterEach(async () => {
    await cleanupTestData(userId)
    await cleanupFirebaseTest()
  })

  test('should create a new note', async () => {
    const noteData = {
      id: 'test-note-1',
      name: 'Test Note',
      content: 'This is a test note content',
      type: 'note',
      parentId: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    await createTestNote(userId, noteData)

    const noteRef = ref(database, `users/${userId}/notes/${noteData.id}`)
    const snapshot = await get(noteRef)
    const savedNote = snapshot.val()

    expect(savedNote).toBeTruthy()
    expect(savedNote.name).toBe(noteData.name)
    expect(savedNote.content).toBe(noteData.content)
  })

  test('should create a folder structure', async () => {
    const folderData = {
      id: 'test-folder-1',
      name: 'Test Folder',
      type: 'folder',
      parentId: null,
      createdAt: Date.now()
    }

    const noteData = {
      id: 'test-note-1',
      name: 'Note in Folder',
      content: 'Content',
      type: 'note',
      parentId: folderData.id,
      createdAt: Date.now()
    }

    await createTestNote(userId, folderData)
    await createTestNote(userId, noteData)

    const folderRef = ref(database, `users/${userId}/notes/${folderData.id}`)
    const noteRef = ref(database, `users/${userId}/notes/${noteData.id}`)

    const [folderSnapshot, noteSnapshot] = await Promise.all([
      get(folderRef),
      get(noteRef)
    ])

    const savedFolder = folderSnapshot.val()
    const savedNote = noteSnapshot.val()

    expect(savedFolder.type).toBe('folder')
    expect(savedNote.parentId).toBe(folderData.id)
  })

  test('should update note content', async () => {
    const noteData = {
      id: 'test-note-1',
      name: 'Test Note',
      content: 'Original content',
      type: 'note',
      parentId: null,
      createdAt: Date.now()
    }

    await createTestNote(userId, noteData)

    const updatedContent = 'Updated content'
    const noteRef = ref(database, `users/${userId}/notes/${noteData.id}`)
    await set(noteRef, { ...noteData, content: updatedContent, updatedAt: Date.now() })

    const snapshot = await get(noteRef)
    const updatedNote = snapshot.val()

    expect(updatedNote.content).toBe(updatedContent)
  })

  test('should delete a note', async () => {
    const noteData = {
      id: 'test-note-1',
      name: 'Test Note',
      content: 'Content to be deleted',
      type: 'note',
      parentId: null,
      createdAt: Date.now()
    }

    await createTestNote(userId, noteData)

    const noteRef = ref(database, `users/${userId}/notes/${noteData.id}`)
    await remove(noteRef)

    const snapshot = await get(noteRef)
    expect(snapshot.val()).toBe(null)
  })
})
