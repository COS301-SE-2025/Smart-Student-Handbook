// __tests__/integration/auth.test.ts
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { setupFirebaseTest, cleanupFirebaseTest } from '../setup/firebase-test-setup'
import { createTestUser } from '../utils/test-helpers'

describe('Authentication Integration Tests', () => {
  const { auth } = setupFirebaseTest()

  beforeEach(async () => {
    await cleanupFirebaseTest()
  })

  afterEach(async () => {
    await cleanupFirebaseTest()
  })

  test('should create a new user account', async () => {
    const email = 'newuser@example.com'
    const password = 'testpassword123'

    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    
    expect(userCredential.user).toBeTruthy()
    expect(userCredential.user.email).toBe(email)
    expect(auth.currentUser).toBeTruthy()
  })

  test('should sign in existing user', async () => {
    const email = 'existinguser@example.com'
    const password = 'testpassword123'

    // Create user first
    await createTestUser(email, password)
    await signOut(auth)

    // Then sign in
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    
    expect(userCredential.user.email).toBe(email)
    expect(auth.currentUser).toBeTruthy()
  })

  test('should handle invalid login credentials', async () => {
    await expect(
      signInWithEmailAndPassword(auth, 'invalid@example.com', 'wrongpassword')
    ).rejects.toThrow()
  })

  test('should sign out user', async () => {
    await createTestUser()
    expect(auth.currentUser).toBeTruthy()

    await signOut(auth)
    expect(auth.currentUser).toBeFalsy()
  })
})