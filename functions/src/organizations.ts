/**
 * organizations.ts
 * Cloud Functions for creating, reading, updating and managing
 * student organisations (study groups).
 */

import { onCall, CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { db } from './firebaseAdmin'

/** Input accepted when creating or updating an organisation */
interface OrgInput {
  name?: string
  description?: string
  isPrivate?: boolean
  image?: string
  invitedUserIds?: string[]
}

/** Payload variants for the different callables */
interface OrgPayload {
  orgId?: string
  userId?: string
  organization?: OrgInput
}

/** Utility – load an organisation or throw 404 */
async function loadOrg(orgId: string) {
  const snap = await db.ref(`organizations/${orgId}`).get()
  if (!snap.exists()) throw new HttpsError('not-found', 'Organization not found')
  return snap.val() as any
}

/* -------------------------------------------------------------------------- */
/*                               create org (1)                               */
/* -------------------------------------------------------------------------- */
export const createOrganization = onCall(
  async (req: CallableRequest<Pick<OrgPayload, 'organization'>>) => {
    const uid = req.auth?.uid
    const org = req.data.organization

    if (!uid) throw new HttpsError('unauthenticated', 'Login required')
    if (!org?.name?.trim()) {
      throw new HttpsError('invalid-argument', 'Organization name is required')
    }

    /* prevent duplicate names */
    const dupSnap = await db.ref('organizations').get()
    const allOrgs = dupSnap.val() as Record<string, any> | null
    if (allOrgs) {
      for (const o of Object.values(allOrgs)) {
        if (o.name === org.name.trim()) {
          throw new HttpsError(
            'already-exists',
            'An organization with that name already exists.'
          )
        }
      }
    }

    /* build members map */
    const members: Record<string, string> = { [uid]: 'Admin' }
    ;(org.invitedUserIds || []).forEach((i) => {
      if (i !== uid) members[i] = 'Member'
    })

    /* push new organisation */
    const refOrg = db.ref('organizations').push()
    const id = refOrg.key!
    const newOrg = {
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
    await db.ref(`userOrganizations/${uid}/${id}`).set(true)
    return newOrg
  }
)

/* -------------------------------------------------------------------------- */
/*                         get public orgs (2) & user orgs (3)                */
/* -------------------------------------------------------------------------- */
export const getPublicOrganizations = onCall(async () => {
  const snap = await db
    .ref('organizations')
    .orderByChild('isPrivate')
    .equalTo(false)
    .get()
  return snap.exists() ? Object.values(snap.val()!) : []
})

export const getUserOrganizations = onCall(async (req: CallableRequest<{}>) => {
  const uid = req.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Login required')

  const snap = await db.ref(`userOrganizations/${uid}`).get()
  if (!snap.exists()) return []

  const ids = Object.keys(snap.val()!)
  return Promise.all(ids.map((id) => loadOrg(id)))
})

/* -------------------------------------------------------------------------- */
/*                            join org (4) / leave org (5)                    */
/* -------------------------------------------------------------------------- */
export const joinOrganization = onCall(
  async (req: CallableRequest<Pick<OrgPayload, 'orgId'>>) => {
    const uid = req.auth?.uid
    const orgId = req.data.orgId

    if (!uid) throw new HttpsError('unauthenticated', 'Login required')
    if (!orgId) throw new HttpsError('invalid-argument', 'Missing orgId')

    const org = await loadOrg(orgId)
    if (org.isPrivate)
      throw new HttpsError('permission-denied', 'Cannot join a private organization')

    await db.ref(`organizations/${orgId}/members/${uid}`).set('Member')
    await db.ref(`userOrganizations/${uid}/${orgId}`).set(true)
    return { success: true }
  }
)

export const leaveOrganization = onCall(
  async (req: CallableRequest<Pick<OrgPayload, 'orgId'>>) => {
    const uid = req.auth?.uid
    const orgId = req.data.orgId

    if (!uid) throw new HttpsError('unauthenticated', 'Login required')
    if (!orgId) throw new HttpsError('invalid-argument', 'Missing orgId')

    const snap = await db.ref(`organizations/${orgId}`).get()
    if (!snap.exists()) throw new HttpsError('not-found', 'Organization not found')

    const org = snap.val() as any
    const memberIds = Object.keys(org.members || {})

    if (!org.members?.[uid]) throw new HttpsError('permission-denied', 'Not a member')

    /* sole member → delete org */
    if (memberIds.length === 1 && memberIds[0] === uid) {
      await db.ref(`userFavorites/${uid}/${orgId}`).remove()
      await db.ref(`userOrganizations/${uid}/${orgId}`).remove()
      await db.ref(`organizations/${orgId}`).remove()
      return { success: true, deleted: true }
    }

    /* owner leaves → transfer ownership */
    if (org.ownerId === uid) {
      const otherIds = memberIds.filter((id) => id !== uid).sort()
      const newOwner = otherIds[0]
      await db.ref(`organizations/${orgId}/ownerId`).set(newOwner)
      await db.ref(`organizations/${orgId}/members/${newOwner}`).set('Admin')
    }

    await db.ref(`organizations/${orgId}/members/${uid}`).remove()
    await db.ref(`userOrganizations/${uid}/${orgId}`).remove()
    await db.ref(`userFavorites/${uid}/${orgId}`).remove()

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

    if (!uid) throw new HttpsError('unauthenticated', 'Login required')
    if (!orgId || !userId)
      throw new HttpsError('invalid-argument', 'Missing orgId or userId')

    const org = await loadOrg(orgId)
    if (org.ownerId !== uid && org.members[uid] !== 'Admin') {
      throw new HttpsError('permission-denied', 'Admin only')
    }

    // 1) Add the member
    await db.ref(`organizations/${orgId}/members/${userId}`).set('Member')
    await db.ref(`userOrganizations/${userId}/${orgId}`).set(true)

    // 2) Notify them they've been added
    const notifRef = db.ref(`users/${userId}/notifications`).push()
    const notif = {
      id: notifRef.key,
      type: 'added_to_group',
      orgId,
      fromUserId: uid,
      timestamp: Date.now(),
      message: `You were added to "${org.name}"`,
    }
    await notifRef.set(notif)

    return { success: true }
  }
)

export const removeMember = onCall(
  async (req: CallableRequest<Pick<OrgPayload, 'orgId' | 'userId'>>) => {
    const uid = req.auth?.uid
    const { orgId, userId } = req.data

    if (!uid) throw new HttpsError('unauthenticated', 'Login required')
    if (!orgId || !userId)
      throw new HttpsError('invalid-argument', 'Missing orgId or userId')

    const org = await loadOrg(orgId)
    if (org.ownerId !== uid && org.members[uid] !== 'Admin') {
      throw new HttpsError('permission-denied', 'Admin only')
    }
    if (userId === org.ownerId)
      throw new HttpsError('permission-denied', 'Cannot remove the owner')

    await db.ref(`organizations/${orgId}/members/${userId}`).remove()
    await db.ref(`userOrganizations/${userId}/${orgId}`).remove()
    return { success: true }
  }
)

export const deleteOrganization = onCall(
  async (req: CallableRequest<Pick<OrgPayload, 'orgId'>>) => {
    const uid = req.auth?.uid
    const orgId = req.data.orgId

    if (!uid) throw new HttpsError('unauthenticated', 'Login required')
    if (!orgId) throw new HttpsError('invalid-argument', 'Missing orgId')

    const org = await loadOrg(orgId)
    if (org.ownerId !== uid)
      throw new HttpsError('permission-denied', 'Only owner can delete')

    for (const m of Object.keys(org.members || {})) {
      await db.ref(`userOrganizations/${m}/${orgId}`).remove()
    }
    await db.ref(`organizations/${orgId}`).remove()
    return { success: true }
  }
)

export const updateOrganization = onCall(
  async (
    req: CallableRequest<Pick<OrgPayload, 'orgId' | 'organization'>>
  ) => {
    const uid = req.auth?.uid
    const { orgId, organization } = req.data

    if (!uid) throw new HttpsError('unauthenticated', 'Login required')
    if (!orgId || !organization)
      throw new HttpsError('invalid-argument', 'Missing orgId or organization data')

    const org = await loadOrg(orgId)
    if (!org.members?.[uid]) {
      throw new HttpsError('permission-denied', 'Not a member')
    }

    const updates: Record<string, any> = {}
    if (organization.name) updates.name = organization.name.trim()
    if (organization.description) updates.description = organization.description.trim()
    if (organization.image !== undefined) updates.image = organization.image
    if (organization.isPrivate !== undefined) updates.isPrivate = organization.isPrivate

    if (!Object.keys(updates).length)
      throw new HttpsError('invalid-argument', 'Nothing to update')

    await db.ref(`organizations/${orgId}`).update(updates)
    return { success: true, updates }
  }
)
