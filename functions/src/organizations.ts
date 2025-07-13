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

    // Prevent duplicate names
    const dupSnap = await db
      .ref('organizations')
      .orderByChild('name')
      .equalTo(org.name.trim())
      .get()
    if (dupSnap.exists()) {
      throw new HttpsError(
        'already-exists',
        'An organization with that name already exists.'
      )
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

    // Push new org under /organizations
    const refOrg = db.ref('organizations').push()
    const id = refOrg.key!
    const newOrg: Org = {
      id,
      ownerId: uid,
      name: org.name.trim(),
      description: org.description || '',
      isPrivate: !!org.isPrivate,
      image: org.image || '',
      members,
      createdAt: Date.now(),
    }
    await refOrg.set(newOrg)

    // Index private org under each invited user
    if (newOrg.isPrivate) {
      const memberIds = Object.keys(members)
      await Promise.all(
        memberIds.map(memberId =>
          db
            .ref(`users/${memberId}/privateOrganizations/${id}`)
            .set({ role: members[memberId] })
        )
      )
    }

    // Notify all users of a new public org, except the creator
    if (!newOrg.isPrivate) {
      const usersSnap = await db.ref('users').get()
      if (usersSnap.exists()) {
        const allUserIds = Object.keys(usersSnap.val() as any)
          .filter(u => u !== newOrg.ownerId)  // skip the creator
        await Promise.all(
          allUserIds.map(userId =>
            db
              .ref(`users/${userId}/notifications`)
              .push()
              .set({
                id: db.ref().push().key,
                type: 'new_public_org',
                orgId: newOrg.id,
                timestamp: Date.now(),
                message: `A new organisation "${newOrg.name}" has been created.`,
              })
          )
        )
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
/*                    get private orgs for a user (3)                        */
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
/*                            join org (4) / leave org (5)                   */
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
      throw new HttpsError(
        'permission-denied',
        'Cannot join a private organization'
      )
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

    if (memberIds.length === 1 && memberIds[0] === uid) {
      if (org.isPrivate) {
        await db.ref(`users/${uid}/privateOrganizations/${orgId}`).remove()
      }
      await db.ref(`organizations/${orgId}`).remove()
      return { success: true, deleted: true }
    }

    if (org.ownerId === uid) {
      const others = memberIds.filter(id => id !== uid).sort()
      const newOwner = others[0]
      await db.ref(`organizations/${orgId}/ownerId`).set(newOwner)
      await db.ref(`organizations/${orgId}/members/${newOwner}`).set('Admin')
    }

    await db.ref(`organizations/${orgId}/members/${uid}`).remove()
    if (org.isPrivate) {
      await db.ref(`users/${uid}/privateOrganizations/${orgId}`).remove()
    }

    return { success: true, transferred: org.ownerId === uid }
  }
)

/* -------------------------------------------------------------------------- */
/*                      add member (6) – send "added_to_group" notice         */
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

    await db.ref(`organizations/${orgId}/members/${userId}`).set('Member')
    if (org.isPrivate) {
      await db
        .ref(`users/${userId}/privateOrganizations/${orgId}`)
        .set({ role: 'Member' })
    }

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
/*                            deleteOrganization                             */
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

    for (const m of Object.keys(org.members || {})) {
      if (org.isPrivate) {
        await db.ref(`users/${m}/privateOrganizations/${orgId}`).remove()
      }
    }
    await db.ref(`organizations/${orgId}`).remove()
    return { success: true }
  }
)
