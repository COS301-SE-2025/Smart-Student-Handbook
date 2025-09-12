import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { ref, set, get, remove } from 'firebase/database'
import { httpsCallableFromURL } from 'firebase/functions'
import { setupFirebaseTest, cleanupFirebaseTest } from '../setup/firebase-test-setup'
import { createTestUser, createTestOrganization } from '../utils/test-helpers'

/**
 * Types
 */
interface Organization {
  id: string
  name: string
  description: string
  isPrivate: boolean
  ownerId: string
  members: Record<string, string>
  createdAt: number
}

describe('Organizations Integration Tests', () => {
  const { database, functions } = setupFirebaseTest()
  let testUser: any
  let userId: string

  beforeEach(async () => {
    testUser = await createTestUser()
    userId = testUser.uid
  })

  afterEach(async () => {
    await cleanupFirebaseTest()
  })

  test('should create an organization', async () => {
    const orgData: Organization = {
      id: 'test-org-1',
      name: 'Test Organization',
      description: 'A test organization for integration testing',
      isPrivate: false,
      ownerId: userId,
      members: { [userId]: 'Admin' },
      createdAt: Date.now(),
    }

    await createTestOrganization(orgData)

    const orgRef = ref(database, `organizations/${orgData.id}`)
    const snapshot = await get(orgRef)
    const savedOrg = snapshot.val() as Organization | null

    expect(savedOrg).toBeTruthy()
    expect(savedOrg?.name).toBe(orgData.name)
    expect(savedOrg?.ownerId).toBe(userId)
    expect(savedOrg?.members[userId]).toBe('Admin')
  })

  test('should add member to organization', async () => {
    const orgData: Organization = {
      id: 'test-org-1',
      name: 'Test Organization',
      description: 'Test org',
      isPrivate: false,
      ownerId: userId,
      members: { [userId]: 'Admin' },
      createdAt: Date.now(),
    }

    await createTestOrganization(orgData)

    // Simulate adding a new member
    const newMemberId = 'new-member-id'
    const orgRef = ref(database, `organizations/${orgData.id}/members/${newMemberId}`)
    await set(orgRef, 'Member')

    const memberSnapshot = await get(orgRef)
    const memberRole = memberSnapshot.val() as string | null
    expect(memberRole).toBe('Member')
  })

  test('should handle organization favorites', async () => {
    const orgId = 'test-org-1'

    // Set favorite
    const favRef = ref(database, `userFavorites/${userId}/${orgId}`)
    await set(favRef, true)

    const favSnapshot = await get(favRef)
    const isFavorite = favSnapshot.val() as boolean | null
    expect(isFavorite).toBe(true)

    // Remove favorite
    await remove(favRef)
    const removedSnapshot = await get(favRef)
    const removedValue = removedSnapshot.val() as boolean | null
    expect(removedValue).toBe(null)
  })

  test('should filter organizations by type', async () => {
    const publicOrg: Organization = {
      id: 'public-org',
      name: 'Public Org',
      description: 'Public organization',
      isPrivate: false,
      ownerId: userId,
      members: { [userId]: 'Admin' },
      createdAt: Date.now(),
    }

    const privateOrg: Organization = {
      id: 'private-org',
      name: 'Private Org',
      description: 'Private organization',
      isPrivate: true,
      ownerId: userId,
      members: { [userId]: 'Admin' },
      createdAt: Date.now(),
    }

    await Promise.all([
      createTestOrganization(publicOrg),
      createTestOrganization(privateOrg),
    ])

    // Get all organizations
    const orgsRef = ref(database, 'organizations')
    const snapshot = await get(orgsRef)
    const orgs = snapshot.val() as Record<string, Organization> | null

    expect(orgs).toBeTruthy()

    const allOrgs = Object.values(orgs ?? {})
    const publicOrgs = allOrgs.filter((org) => !org.isPrivate)
    const privateOrgs = allOrgs.filter((org) => org.isPrivate)

    expect(publicOrgs).toHaveLength(1)
    expect(privateOrgs).toHaveLength(1)
    expect(publicOrgs[0].name).toBe('Public Org')
    expect(privateOrgs[0].name).toBe('Private Org')
  })
})
