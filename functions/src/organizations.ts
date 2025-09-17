// functions/src/organizations.ts
import { onCall, CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { db } from './firebaseAdmin'

interface OrgInput {
  name?: string
  description?: string
  isPrivate?: boolean
  image?: string
  invitedUserIds?: string[]
}

interface OrgPayload {
  orgId?: string
  userId?: string
  organization?: OrgInput
}

interface Org {
  id: string
  ownerId: string
  name: string
  description: string
  isPrivate: boolean
  image: string
  members: Record<string, 'Admin' | 'Member'>
  createdAt: number
}

async function loadOrg(orgId: string): Promise<Org> {
  const snap = await db.ref(`organizations/${orgId}`).get()
  if (!snap.exists()) {
    throw new HttpsError('not-found', 'Organization not found')
  }
  return snap.val() as Org
}

/* -------------------------------------------------------------------------- */
/*                               create org (1)                               */
/* -------------------------------------------------------------------------- */
export const createOrganization = onCall(
  async (req: CallableRequest<Pick<OrgPayload, 'organization'>>) => {
    const uid = req.auth?.uid
    const org = req.data.organization

    if (!uid) {
      throw new HttpsError('unauthenticated', 'Login required')
    }
    if (!org?.name?.trim()) {
      throw new HttpsError('invalid-argument', 'Organization name is required')
    }

    const orgName = org.name.trim()

    // Prevent duplicate names - check both public organizations and user's private organizations
    try {
      // Check public organizations
      const publicOrgsSnap = await db.ref('organizations').orderByChild('name').get()
      if (publicOrgsSnap.exists()) {
        const publicOrgs = publicOrgsSnap.val() as Record<string, Org>
        const publicDuplicate = Object.values(publicOrgs).find(
          existingOrg => existingOrg.name.toLowerCase() === orgName.toLowerCase()
        )
        if (publicDuplicate) {
          throw new HttpsError(
            'already-exists',
            'An organization with that name already exists.'
          )
        }
      }

      // Check user's private organizations (by index)
      const userPrivateOrgsSnap = await db.ref(`users/${uid}/privateOrganizations`).get()
      if (userPrivateOrgsSnap.exists()) {
        const userPrivateOrgs = userPrivateOrgsSnap.val() as Record<string, { role: string }>
        const privateOrgIds = Object.keys(userPrivateOrgs)

        // Load each private org to check name
        for (const candidateId of privateOrgIds) {
          const privateOrg = await loadOrg(candidateId)
          if (privateOrg.name.toLowerCase() === orgName.toLowerCase()) {
            throw new HttpsError(
              'already-exists',
              'An organization with that name already exists.'
            )
          }
        }
      }
    } catch (error) {
      if (error instanceof HttpsError) throw error
      console.error('Error checking for duplicate organization names:', error)
      // If duplicate check fails, we still proceed with creation.
    }

    // Build members map
    const invited = Array.isArray(org.invitedUserIds) ? org.invitedUserIds : []
    const members: Record<string, 'Admin' | 'Member'> = { [uid]: 'Admin' }
    if (org.isPrivate) {
      invited.forEach(i => {
        if (i && i !== uid) {
          members[i] = 'Member'
        }
      })
    }

    const isPrivate = !!org.isPrivate
    const id = db.ref('organizations').push().key!

    const newOrg: Org = {
      id,
      ownerId: uid,
      name: orgName,
      description: org.description || '',
      isPrivate,
      image: org.image || '',
      members,
      createdAt: Date.now(),
    }

    if (isPrivate) {
      // =============== FIX: atomic multi-path update ==================
      const root = db.ref()
      const updates: Record<string, any> = {}

      // 1) write org document
      updates[`organizations/${id}`] = newOrg

      // 2) creator index
      updates[`users/${uid}/privateOrganizations/${id}`] = { role: 'Admin' }

      // 3) invited member indexes (exclude creator)
      for (const [memberId, role] of Object.entries(members)) {
        if (memberId !== uid) {
          updates[`users/${memberId}/privateOrganizations/${id}`] = { role }
        }
      }

      // 4) notifications to invited members
      for (const memberId of Object.keys(members)) {
        if (memberId === uid) continue
        const notifKey = root.child(`users/${memberId}/notifications`).push().key!
        updates[`users/${memberId}/notifications/${notifKey}`] = {
          id: notifKey,
          type: 'added_to_group',
          orgId: id,
          fromUserId: uid,
          timestamp: Date.now(),
          message: `You were added to "${newOrg.name}"`,
        }
      }

      // One all-or-nothing commit
      await root.update(updates)
      // ================================================================

    } else {
      // PUBLIC ORGANIZATION:
      await db.ref(`organizations/${id}`).set(newOrg)

      const usersSnap = await db.ref('users').get()
      if (usersSnap.exists()) {
        const allUserIds = Object.keys(usersSnap.val() as any).filter(u => u !== uid)
        const root = db.ref()
        const updates: Record<string, any> = {}
        for (const userId of allUserIds) {
          const notifKey = root.child(`users/${userId}/notifications`).push().key!
          updates[`users/${userId}/notifications/${notifKey}`] = {
            id: notifKey,
            type: 'new_public_org',
            orgId: id,
            timestamp: Date.now(),
            message: `A new organisation "${newOrg.name}" has been created.`,
          }
        }
        if (Object.keys(updates).length) {
          await root.update(updates)
        }
      }
    }

    return newOrg
  }
)

/* -------------------------------------------------------------------------- */
/*                         get public orgs (2)                                */
/* -------------------------------------------------------------------------- */
export const getPublicOrganizations = onCall(async () => {
  const snap = await db
    .ref('organizations')
    .orderByChild('isPrivate')
    .equalTo(false)
    .get()
  return snap.exists() ? (Object.values(snap.val()!) as Org[]) : []
})

/* -------------------------------------------------------------------------- */
/*                    get private orgs for a user (3)                         */
/*  IMPORTANT: We read the user index then hydrate each org.                  */
/* -------------------------------------------------------------------------- */
export const getUserOrganizations = onCall(async (req: CallableRequest<{}>) => {
  const uid = req.auth?.uid
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Login required')
  }

  const snap = await db.ref(`users/${uid}/privateOrganizations`).get()
  if (!snap.exists()) {
    return []
  }

  const idx = snap.val() as Record<string, { role: 'Admin' | 'Member' }>
  const orgs = await Promise.all(
    Object.entries(idx).map(async ([orgId, { role }]) => {
      const org = await loadOrg(orgId)
      return { ...org, role }
    })
  )
  return orgs
})

/* -------------------------------------------------------------------------- */
/*                            join org (4) / leave org (5)                    */
/* -------------------------------------------------------------------------- */
export const joinOrganization = onCall(
  async (req: CallableRequest<Pick<OrgPayload, 'orgId'>>) => {
    const uid = req.auth?.uid
    const orgId = req.data.orgId

    if (!uid) {
      throw new HttpsError('unauthenticated', 'Login required')
    }
    if (!orgId) {
      throw new HttpsError('invalid-argument', 'Missing orgId')
    }

    const org = await loadOrg(orgId)
    if (org.isPrivate) {
      throw new HttpsError('permission-denied', 'Cannot join a private organization')
    }

    await db.ref(`organizations/${orgId}/members/${uid}`).set('Member')
    return { success: true }
  }
)

export const leaveOrganization = onCall(
  async (req: CallableRequest<Pick<OrgPayload, 'orgId'>>) => {
    const uid = req.auth?.uid
    const orgId = req.data.orgId

    if (!uid) {
      throw new HttpsError('unauthenticated', 'Login required')
    }
    if (!orgId) {
      throw new HttpsError('invalid-argument', 'Missing orgId')
    }

    const snap = await db.ref(`organizations/${orgId}`).get()
    if (!snap.exists()) {
      throw new HttpsError('not-found', 'Organization not found')
    }

    const org = snap.val() as Org
    const memberIds = Object.keys(org.members || {})

    if (!org.members?.[uid]) {
      throw new HttpsError('permission-denied', 'Not a member')
    }

    // sole member → delete org
    if (memberIds.length === 1 && memberIds[0] === uid) {
      if (org.isPrivate) {
        await db.ref(`users/${uid}/privateOrganizations/${orgId}`).remove()
      }
      await db.ref(`organizations/${orgId}`).remove()
      return { success: true, deleted: true }
    }

    // owner leaves → transfer ownership to lexicographically-first remaining member
    if (org.ownerId === uid) {
      const others = memberIds.filter(id => id !== uid).sort()
      const newOwner = others[0]
      await db.ref(`organizations/${orgId}/ownerId`).set(newOwner)
      await db.ref(`organizations/${orgId}/members/${newOwner}`).set('Admin')
    }

    // remove membership
    await db.ref(`organizations/${orgId}/members/${uid}`).remove()

    // for private orgs, also remove user index
    if (org.isPrivate) {
      await db.ref(`users/${uid}/privateOrganizations/${orgId}`).remove()
    }

    return { success: true, transferred: org.ownerId === uid }
  }
)

/* -------------------------------------------------------------------------- */
/*                      add member (6) / remove member (7)                    */
/* -------------------------------------------------------------------------- */
export const addMember = onCall(
  async (req: CallableRequest<Pick<OrgPayload, 'orgId' | 'userId'>>) => {
    const uid = req.auth?.uid
    const { orgId, userId } = req.data

    if (!uid) {
      throw new HttpsError('unauthenticated', 'Login required')
    }
    if (!orgId || !userId) {
      throw new HttpsError('invalid-argument', 'Missing orgId or userId')
    }

    const org = await loadOrg(orgId)
    if (org.ownerId !== uid && org.members[uid] !== 'Admin') {
      throw new HttpsError('permission-denied', 'Admin only')
    }

    // add to org.members
    await db.ref(`organizations/${orgId}/members/${userId}`).set('Member')

    // For private orgs, index under user's private organizations
    if (org.isPrivate) {
      await db.ref(`users/${userId}/privateOrganizations/${orgId}`).set({ role: 'Member' })
    }

    // push notification
    const notifRef = db.ref(`users/${userId}/notifications`).push()
    await notifRef.set({
      id: notifRef.key,
      type: 'added_to_group',
      orgId,
      fromUserId: uid,
      timestamp: Date.now(),
      message: `You were added to "${org.name}"`,
    })

    return { success: true }
  }
)

export const removeMember = onCall(
  async (req: CallableRequest<Pick<OrgPayload, 'orgId' | 'userId'>>) => {
    const uid = req.auth?.uid
    const { orgId, userId } = req.data

    if (!uid) {
      throw new HttpsError('unauthenticated', 'Login required')
    }
    if (!orgId || !userId) {
      throw new HttpsError('invalid-argument', 'Missing orgId or userId')
    }

    const org = await loadOrg(orgId)
    if (org.ownerId !== uid && org.members[uid] !== 'Admin') {
      throw new HttpsError('permission-denied', 'Admin only')
    }
    if (userId === org.ownerId) {
      throw new HttpsError('permission-denied', 'Cannot remove the owner')
    }

    await db.ref(`organizations/${orgId}/members/${userId}`).remove()
    if (org.isPrivate) {
      await db.ref(`users/${userId}/privateOrganizations/${orgId}`).remove()
    }

    return { success: true }
  }
)

/* -------------------------------------------------------------------------- */
/*                            deleteOrganization                               */
/* -------------------------------------------------------------------------- */
export const deleteOrganization = onCall(
  async (req: CallableRequest<Pick<OrgPayload, 'orgId'>>) => {
    const uid = req.auth?.uid
    const orgId = req.data.orgId

    if (!uid) {
      throw new HttpsError('unauthenticated', 'Login required')
    }
    if (!orgId) {
      throw new HttpsError('invalid-argument', 'Missing orgId')
    }

    const org = await loadOrg(orgId)
    if (org.ownerId !== uid) {
      throw new HttpsError('permission-denied', 'Only owner can delete')
    }

    // Remove from all members' private organizations (if private)
    if (org.isPrivate) {
      for (const memberId of Object.keys(org.members || {})) {
        await db.ref(`users/${memberId}/privateOrganizations/${orgId}`).remove()
      }
    }

    // Remove the organization data
    await db.ref(`organizations/${orgId}`).remove()

    return { success: true }
  }
)

/* -------------------------------------------------------------------------- */
/*                Backfill indexes for existing private orgs                  */
/* -------------------------------------------------------------------------- */
export const reindexPrivateOrganizationMemberships = onCall(async (req) => {
  const uid = req.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Login required')

  // Gate this callable to allowed admin UIDs
  const allowedAdmins = new Set<string>([
    // 'U9mbOMterhVEpKjRGV2YDYHCBl03',
  ])
  if (!allowedAdmins.has(uid)) {
    throw new HttpsError('permission-denied', 'Admin only')
  }

  const snap = await db.ref('organizations').orderByChild('isPrivate').equalTo(true).get()
  if (!snap.exists()) return { updatedUsers: 0, updatedLinks: 0 }

  const orgs: Record<string, Org> = snap.val()
  const updates: Record<string, any> = {}
  let updatedLinks = 0
  const touchedUsers = new Set<string>()

  for (const org of Object.values(orgs)) {
    for (const [memberId, role] of Object.entries(org.members || {})) {
      const path = `users/${memberId}/privateOrganizations/${org.id}`
      updates[path] = { role }
      updatedLinks++
      touchedUsers.add(memberId)
    }
  }

  if (updatedLinks > 0) {
    await db.ref().update(updates)
  }

  return { updatedUsers: touchedUsers.size, updatedLinks }
})
