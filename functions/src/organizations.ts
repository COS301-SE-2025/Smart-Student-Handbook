// functions/src/organizations.ts

import { onCall, CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { db } from './firebaseAdmin'

/** Input when creating or editing */
interface OrgInput {
  name?: string
  description?: string
  isPrivate?: boolean
  image?: string
  invitedUserIds?: string[]
}

/** Payload shapes for each callable */
interface OrgPayload {
  orgId?: string
  userId?: string
  organization?: OrgInput
}

/** Stored organization shape */
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

/** Helper for private-org index path */
const privIdx = (uid: string, orgId: string) =>
  `users/${uid}/privateOrganizations/${orgId}`

/** Wrap any thrown error into an HttpsError */
function wrap<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch(err => {
    if (err instanceof HttpsError) throw err
    throw new HttpsError('internal', (err as Error).message)
  })
}

/** GET all public orgs */
export const getPublicOrganizations = onCall((req) =>
  wrap(async () => {
    const snap = await db
      .ref('organizations')
      .orderByChild('isPrivate')
      .equalTo(false)
      .get()
    return snap.exists() ? (Object.values(snap.val()!) as Org[]) : []
  })
)

/** GET only the private orgs this user belongs to — efficient + cleans stale */
export const getUserOrganizations = onCall((req: CallableRequest<{}>) =>
  wrap(async () => {
    const uid = req.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'Login required')

    // 1) read index of private org IDs & roles
    const idxSnap = await db.ref(`users/${uid}/privateOrganizations`).get()
    if (!idxSnap.exists()) return []

    const idx = idxSnap.val() as Record<string, { role: 'Admin' | 'Member' }>
    const orgIds = Object.keys(idx)

    // 2) fetch only those orgs in parallel
    const snaps = await Promise.all(
      orgIds.map(orgId => db.ref(`organizations/${orgId}`).get())
    )

    // 3) build result, cleaning up stale entries
    return snaps.reduce<(Org & { role: 'Admin' | 'Member' })[]>((acc, snap, i) => {
      const orgId = orgIds[i]
      if (snap.exists()) {
        acc.push({ ...(snap.val() as Org), role: idx[orgId].role })
      } else {
        // stale index → remove
        db.ref(`users/${uid}/privateOrganizations/${orgId}`).remove()
      }
      return acc
    }, [])
  })
)

/** CREATE a new org (public or private), prevents duplicates */
export const createOrganization = onCall((req: CallableRequest<Pick<OrgPayload, 'organization'>>) =>
  wrap(async () => {
    const uid = req.auth?.uid
    const org = req.data.organization
    if (!uid) throw new HttpsError('unauthenticated', 'Login required')
    if (!org?.name?.trim())
      throw new HttpsError('invalid-argument', 'Organization name is required')

    // duplicate-name check
    const dup = await db
      .ref('organizations')
      .orderByChild('name')
      .equalTo(org.name.trim())
      .get()
    if (dup.exists())
      throw new HttpsError(
        'already-exists',
        'An organization with that name already exists.'
      )

    const invited = Array.isArray(org.invitedUserIds)
      ? org.invitedUserIds.filter(id => id && id !== uid)
      : []

    // build members map
    const members: Record<string, 'Admin' | 'Member'> = { [uid]: 'Admin' }
    if (org.isPrivate) invited.forEach(id => (members[id] = 'Member'))

    // write org
    const refOrg = db.ref('organizations').push()
    const orgId = refOrg.key!
    const dataOrg: Org = {
      id: orgId,
      ownerId: uid,
      name: org.name.trim(),
      description: org.description || '',
      isPrivate: !!org.isPrivate,
      image: org.image || '',
      members,
      createdAt: Date.now(),
    }
    await refOrg.set(dataOrg)

    if (dataOrg.isPrivate) {
      // index owner
      await db.ref(privIdx(uid, orgId)).set({ role: 'Admin' })
      // index & notify invited
      await Promise.all(
        invited.map(async memberId => {
          await db.ref(privIdx(memberId, orgId)).set({ role: 'Member' })
          const n = db.ref(`users/${memberId}/notifications`).push()
          await n.set({
            id: n.key,
            type: 'added_to_group',
            orgId,
            fromUserId: uid,
            timestamp: Date.now(),
            message: `You were added to "${dataOrg.name}"`,
          })
        })
      )
    } else {
      // broadcast new public org
      const usersSnap = await db.ref('users').get()
      if (usersSnap.exists()) {
        const allUids = Object.keys(usersSnap.val() as object).filter(u => u !== uid)
        await Promise.all(
          allUids.map(async other => {
            const n = db.ref(`users/${other}/notifications`).push()
            await n.set({
              id: n.key,
              type: 'new_public_org',
              orgId,
              timestamp: Date.now(),
              message: `A new organisation "${dataOrg.name}" has been created.`,
            })
          })
        )
      }
    }

    return dataOrg
  })
)

/** UPDATE an org’s metadata (owner/admin only), duplicate-name protected */
export const updateOrganization = onCall((req: CallableRequest<Pick<OrgPayload, 'orgId' | 'organization'>>) =>
  wrap(async () => {
    const uid = req.auth?.uid
    const { orgId, organization } = req.data
    if (!uid) throw new HttpsError('unauthenticated', 'Login required')
    if (!orgId || !organization)
      throw new HttpsError('invalid-argument', 'Missing orgId or organization input')

    const orgSnap = await db.ref(`organizations/${orgId}`).get()
    if (!orgSnap.exists())
      throw new HttpsError('not-found', 'Organization not found')
    const org = orgSnap.val() as Org

    if (org.ownerId !== uid && org.members[uid] !== 'Admin')
      throw new HttpsError('permission-denied', 'Admin only')

    const updates: Record<string, any> = {}
    if (organization.name?.trim() && organization.name.trim() !== org.name) {
      // duplicate-name check
      const dup = await db
        .ref('organizations')
        .orderByChild('name')
        .equalTo(organization.name.trim())
        .get()
      if (dup.exists()) throw new HttpsError('already-exists', 'Name in use')
      updates.name = organization.name.trim()
    }
    if (organization.description !== undefined)
      updates.description = organization.description
    if (organization.image !== undefined) updates.image = organization.image
    if (typeof organization.isPrivate === 'boolean')
      updates.isPrivate = organization.isPrivate

    if (Object.keys(updates).length === 0)
      throw new HttpsError('invalid-argument', 'Nothing to update')

    await db.ref(`organizations/${orgId}`).update(updates)
    return (await db.ref(`organizations/${orgId}`).get()).val()
  })
)

/** JOIN a public org (private orgs forbidden) */
export const joinOrganization = onCall((req: CallableRequest<Pick<OrgPayload, 'orgId'>>) =>
  wrap(async () => {
    const uid = req.auth?.uid
    const orgId = req.data.orgId
    if (!uid) throw new HttpsError('unauthenticated', 'Login required')
    if (!orgId) throw new HttpsError('invalid-argument', 'Missing orgId')

    const snap = await db.ref(`organizations/${orgId}`).get()
    if (!snap.exists())
      throw new HttpsError('not-found', 'Organization not found')
    const org = snap.val() as Org
    if (org.isPrivate)
      throw new HttpsError('permission-denied', 'Cannot join a private organization')

    await db.ref(`organizations/${orgId}/members/${uid}`).set('Member')
    return { success: true }
  })
)

/** LEAVE an org (handles sole-member delete, owner transfer, stale-index cleanup) */
export const leaveOrganization = onCall((req: CallableRequest<Pick<OrgPayload, 'orgId'>>) =>
  wrap(async () => {
    const uid = req.auth?.uid
    const orgId = req.data.orgId
    if (!uid) throw new HttpsError('unauthenticated', 'Login required')
    if (!orgId) throw new HttpsError('invalid-argument', 'Missing orgId')

    const snap = await db.ref(`organizations/${orgId}`).get()
    if (!snap.exists())
      throw new HttpsError('not-found', 'Organization not found')
    const org = snap.val() as Org
    if (!org.members[uid])
      throw new HttpsError('permission-denied', 'Not a member')

    const memberIds = Object.keys(org.members)
    // sole member → delete entire org
    if (memberIds.length === 1) {
      if (org.isPrivate) await db.ref(privIdx(uid, orgId)).remove()
      await db.ref(`organizations/${orgId}`).remove()
      return { success: true, deleted: true }
    }

    // transfer ownership if needed
    let transferred = false
    if (org.ownerId === uid) {
      const nextOwner = memberIds.filter(m => m !== uid).sort()[0]
      await db.ref(`organizations/${orgId}/ownerId`).set(nextOwner)
      await db.ref(`organizations/${orgId}/members/${nextOwner}`).set('Admin')
      transferred = true
    }

    // remove member + cleanup index
    await db.ref(`organizations/${orgId}/members/${uid}`).remove()
    if (org.isPrivate) await db.ref(privIdx(uid, orgId)).remove()

    return { success: true, transferred }
  })
)

/** ADD a member to a private org (Admin only) */
export const addMember = onCall((req: CallableRequest<Pick<OrgPayload, 'orgId' | 'userId'>>) =>
  wrap(async () => {
    const uid = req.auth?.uid
    const { orgId, userId } = req.data
    if (!uid) throw new HttpsError('unauthenticated', 'Login required')
    if (!orgId || !userId)
      throw new HttpsError('invalid-argument', 'Missing orgId or userId')

    const snap = await db.ref(`organizations/${orgId}`).get()
    if (!snap.exists())
      throw new HttpsError('not-found', 'Organization not found')
    const org = snap.val() as Org
    if (org.ownerId !== uid && org.members[uid] !== 'Admin')
      throw new HttpsError('permission-denied', 'Admin only')

    await db.ref(`organizations/${orgId}/members/${userId}`).set('Member')
    if (org.isPrivate) await db.ref(privIdx(userId, orgId)).set({ role: 'Member' })

    const n = db.ref(`users/${userId}/notifications`).push()
    await n.set({
      id: n.key,
      type: 'added_to_group',
      orgId,
      fromUserId: uid,
      timestamp: Date.now(),
      message: `You were added to "${org.name}"`,
    })

    return { success: true }
  })
)

/** REMOVE a member (Admin only, cannot remove owner) */
export const removeMember = onCall((req: CallableRequest<Pick<OrgPayload, 'orgId' | 'userId'>>) =>
  wrap(async () => {
    const uid = req.auth?.uid
    const { orgId, userId } = req.data
    if (!uid) throw new HttpsError('unauthenticated', 'Login required')
    if (!orgId || !userId)
      throw new HttpsError('invalid-argument', 'Missing orgId or userId')

    const snap = await db.ref(`organizations/${orgId}`).get()
    if (!snap.exists())
      throw new HttpsError('not-found', 'Organization not found')
    const org = snap.val() as Org
    if (org.ownerId !== uid && org.members[uid] !== 'Admin')
      throw new HttpsError('permission-denied', 'Admin only')
    if (userId === org.ownerId)
      throw new HttpsError('permission-denied', 'Cannot remove the owner')

    await db.ref(`organizations/${orgId}/members/${userId}`).remove()
    if (org.isPrivate) await db.ref(privIdx(userId, orgId)).remove()

    return { success: true }
  })
)

/** DELETE an organization (owner only), cleans up private indexes */
export const deleteOrganization = onCall((req: CallableRequest<Pick<OrgPayload, 'orgId'>>) =>
  wrap(async () => {
    const uid = req.auth?.uid
    const orgId = req.data.orgId
    if (!uid) throw new HttpsError('unauthenticated', 'Login required')
    if (!orgId) throw new HttpsError('invalid-argument', 'Missing orgId')

    const snap = await db.ref(`organizations/${orgId}`).get()
    if (!snap.exists())
      throw new HttpsError('not-found', 'Organization not found')
    const org = snap.val() as Org
    if (org.ownerId !== uid)
      throw new HttpsError('permission-denied', 'Only owner can delete')

    // remove all private indexes
    if (org.isPrivate) {
      await Promise.all(
        Object.keys(org.members).map(m => db.ref(privIdx(m, orgId)).remove())
      )
    }
    await db.ref(`organizations/${orgId}`).remove()
    return { success: true }
  })
)
