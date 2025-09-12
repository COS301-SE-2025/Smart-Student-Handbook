// __tests__/utils/test-helpers.ts
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { ref, set, remove } from 'firebase/database'
import { setupFirebaseTest } from '../setup/firebase-test-setup'

const { auth, database } = setupFirebaseTest()

export const createTestUser = async (email: string = 'test@example.com', password: string = 'testpassword') => {
  try {
    // Sign out any current user first
    if (auth.currentUser) {
      await signOut(auth)
    }
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    return userCredential.user
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      // User already exists, sign in instead
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      return userCredential.user
    }
    throw error
  }
}

export const createTestNote = async (userId: string, noteData: any) => {
  const noteRef = ref(database, `users/${userId}/notes/${noteData.id}`)
  await set(noteRef, noteData)
  return noteData
}

export const createTestOrganization = async (orgData: any) => {
  const orgRef = ref(database, `organizations/${orgData.id}`)
  await set(orgRef, orgData)
  return orgData
}

export const cleanupTestData = async (userId: string) => {
  try {
    await remove(ref(database, `users/${userId}`))
  } catch (error) {
    console.log('Cleanup error:', error)
  }
}

export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))