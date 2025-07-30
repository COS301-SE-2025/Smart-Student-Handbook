import { onCall, CallableRequest, HttpsError } from "firebase-functions/v2/https"
import { db } from "./firebaseAdmin"

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */
interface Member {
  id: string
  name: string
  email: string
  role: "Admin" | "Member"
  joinedAt: number
}

interface OrgActivity {
  id: string
  type:
    | "member_joined"
    | "member_left"
    | "note_created"
    | "note_updated"
    | "org_updated"
  description: string
  user: string
  timestamp: number
}

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
  members: Record<string, "Admin" | "Member">
  createdAt: number
}

interface OrganizationDetails extends Org {
  memberDetails: Member[]
  activities: OrgActivity[]
  noteCount?: number
  lastActivity?: number
}

/* -------------------------------------------------------------------------- */
/*                               Helpers                                      */
/* -------------------------------------------------------------------------- */
const privIdx = (uid: string, orgId: string) =>
  `users/${uid}/privateOrganizations/${orgId}`

const wrap = <T,>(fn: () => Promise<T>): Promise<T> =>
  fn().catch((err) => {
    if (err instanceof HttpsError) throw err
    throw new HttpsError("internal", (err as Error).message)
  })

/* -------------------------------------------------------------------------- */
/*                          getOrganizationDetails                            */
/* -------------------------------------------------------------------------- */
export const getOrganizationDetails = onCall(
  (req: CallableRequest<{ orgId: string }>) =>
    wrap<OrganizationDetails>(async () => {
      const uid = req.auth?.uid ?? null
      const { orgId } = req.data
      if (!orgId) throw new HttpsError("invalid-argument", "Missing orgId")

      const orgSnap = await db.ref(`organizations/${orgId}`).get()
      if (!orgSnap.exists())
        throw new HttpsError("not-found", "Organisation not found")
      const org = orgSnap.val() as Org

      if (org.isPrivate && (!uid || !org.members?.[uid]))
        throw new HttpsError("permission-denied", "Not a member")

      const memberDetails: Member[] = await Promise.all(
        Object.entries(org.members).map(async ([memberId, role]) => {
          const profileSnap = await db.ref(`users/${memberId}/profile`).get()
          const profile = profileSnap.exists() ? profileSnap.val() : {}
          return {
            id: memberId,
            name: profile?.name ?? `User ${memberId.slice(0, 5)}`,
            email: profile?.email ?? "",
            role: role as "Admin" | "Member",
            joinedAt: profile?.createdAt ?? org.createdAt
          }
        })
      )

      const actSnap = await db
        .ref(`organizations/${orgId}/activities`)
        .orderByChild("timestamp")
        .limitToLast(50)
        .get()
      const activities: OrgActivity[] = actSnap.exists()
        ? (Object.values(actSnap.val()) as OrgActivity[]).sort(
            (a, b) => b.timestamp - a.timestamp
          )
        : []

      const notesSnap = await db.ref(`organizations/${orgId}/notes`).get()
      const noteCount = notesSnap.exists()
        ? Object.keys(notesSnap.val()).length
        : 0
      const lastActivity =
        activities[0]?.timestamp ?? org.createdAt

      return {
        ...org,
        memberDetails,
        activities,
        noteCount,
        lastActivity
      }
    })
)

/* -------------------------------------------------------------------------- */
/*                          updateOrganization                                */
/* -------------------------------------------------------------------------- */
export const updateOrganization = onCall(
  (req: CallableRequest<Pick<OrgPayload, "orgId" | "organization">>) =>
    wrap<OrganizationDetails>(async () => {
      const uid = req.auth?.uid
      const { orgId, organization } = req.data
      if (!uid) throw new HttpsError("unauthenticated", "Login required")
      if (!orgId || !organization)
        throw new HttpsError("invalid-argument", "Missing data")

      const orgRef = db.ref(`organizations/${orgId}`)
      const orgSnap = await orgRef.get()
      if (!orgSnap.exists())
        throw new HttpsError("not-found", "Organisation not found")
      const org = orgSnap.val() as Org

      if (org.ownerId !== uid && org.members[uid] !== "Admin")
        throw new HttpsError("permission-denied", "Admin only")

      const updates: Record<string, unknown> = {}
      if (organization.name?.trim() && organization.name.trim() !== org.name) {
        const dup = await db
          .ref("organizations")
          .orderByChild("name")
          .equalTo(organization.name.trim())
          .get()
        if (dup.exists())
          throw new HttpsError("already-exists", "Name in use")
        updates.name = organization.name.trim()
      }
      if (organization.description !== undefined)
        updates.description = organization.description
      if (typeof organization.isPrivate === "boolean")
        updates.isPrivate = organization.isPrivate
      if (organization.image !== undefined) updates.image = organization.image

      if (Object.keys(updates).length === 0)
        throw new HttpsError("invalid-argument", "Nothing to update")

      await orgRef.update(updates)

      const activityRef = db.ref(`organizations/${orgId}/activities`).push()
      await activityRef.set({
        id: activityRef.key,
        type: "org_updated",
        description: "Organisation details updated",
        user: uid,
        timestamp: Date.now()
      })

      /* build and return fresh OrganizationDetails */
      const updatedOrgSnap = await orgRef.get()
      const updatedOrg = updatedOrgSnap.val() as Org

      const memberDetails: Member[] = await Promise.all(
        Object.entries(updatedOrg.members).map(async ([memberId, role]) => {
          const profileSnap = await db.ref(`users/${memberId}/profile`).get()
          const profile = profileSnap.exists() ? profileSnap.val() : {}
          return {
            id: memberId,
            name: profile?.name ?? `User ${memberId.slice(0, 5)}`,
            email: profile?.email ?? "",
            role: role as "Admin" | "Member",
            joinedAt: profile?.createdAt ?? updatedOrg.createdAt
          }
        })
      )

      const actSnap = await db
        .ref(`organizations/${orgId}/activities`)
        .orderByChild("timestamp")
        .limitToLast(50)
        .get()
      const activities: OrgActivity[] = actSnap.exists()
        ? (Object.values(actSnap.val()) as OrgActivity[]).sort(
            (a, b) => b.timestamp - a.timestamp
          )
        : []

      const notesSnap = await db.ref(`organizations/${orgId}/notes`).get()
      const noteCount = notesSnap.exists()
        ? Object.keys(notesSnap.val()).length
        : 0
      const lastActivity =
        activities[0]?.timestamp ?? updatedOrg.createdAt

      return {
        ...updatedOrg,
        memberDetails,
        activities,
        noteCount,
        lastActivity
      }
    })
)

/* -------------------------------------------------------------------------- */
/*                      getPublicOrganizations                                */
/* -------------------------------------------------------------------------- */
export const getPublicOrganizations = onCall((req) =>
  wrap(async () => {
    const snap = await db
      .ref("organizations")
      .orderByChild("isPrivate")
      .equalTo(false)
      .get()
    return snap.exists() ? (Object.values(snap.val()!) as Org[]) : []
  })
)

/* -------------------------------------------------------------------------- */
/*                      getUserOrganizations                                  */
/* -------------------------------------------------------------------------- */
export const getUserOrganizations = onCall((req: CallableRequest<{}>) =>
  wrap(async () => {
    const uid = req.auth?.uid
    if (!uid) throw new HttpsError("unauthenticated", "Login required")

    const idxSnap = await db.ref(`users/${uid}/privateOrganizations`).get()
    if (!idxSnap.exists()) return []

    const idx = idxSnap.val() as Record<string, { role: "Admin" | "Member" }>
    const orgIds = Object.keys(idx)

    const snaps = await Promise.all(
      orgIds.map((o) => db.ref(`organizations/${o}`).get())
    )

    return snaps.reduce<(Org & { role: "Admin" | "Member" })[]>(
      (acc, snap, i) => {
        const id = orgIds[i]
        if (snap.exists()) {
          acc.push({ ...(snap.val() as Org), role: idx[id].role })
        } else {
          db.ref(`users/${uid}/privateOrganizations/${id}`).remove()
        }
        return acc
      },
      []
    )
  })
)

/* -------------------------------------------------------------------------- */
/*                       createOrganization                                   */
/* -------------------------------------------------------------------------- */
export const createOrganization = onCall(
  (req: CallableRequest<Pick<OrgPayload, "organization">>) =>
    wrap(async () => {
      const uid = req.auth?.uid
      const org = req.data.organization
      if (!uid) throw new HttpsError("unauthenticated", "Login required")
      if (!org?.name?.trim())
        throw new HttpsError("invalid-argument", "Organisation name required")

      const dup = await db
        .ref("organizations")
        .orderByChild("name")
        .equalTo(org.name.trim())
        .get()
      if (dup.exists())
        throw new HttpsError("already-exists", "Name already exists")

      const invited = Array.isArray(org.invitedUserIds)
        ? org.invitedUserIds.filter((id) => id && id !== uid)
        : []

      const members: Record<string, "Admin" | "Member"> = { [uid]: "Admin" }
      if (org.isPrivate) invited.forEach((id) => (members[id] = "Member"))

      const refOrg = db.ref("organizations").push()
      const orgId = refOrg.key!
      const dataOrg: Org = {
        id: orgId,
        ownerId: uid,
        name: org.name.trim(),
        description: org.description || "",
        isPrivate: !!org.isPrivate,
        image: org.image || "",
        members,
        createdAt: Date.now()
      }
      await refOrg.set(dataOrg)

      if (dataOrg.isPrivate) {
        await db.ref(privIdx(uid, orgId)).set({ role: "Admin" })
        await Promise.all(
          invited.map(async (memberId) => {
            await db.ref(privIdx(memberId, orgId)).set({ role: "Member" })
            const n = db.ref(`users/${memberId}/notifications`).push()
            await n.set({
              id: n.key,
              type: "added_to_group",
              orgId,
              fromUserId: uid,
              timestamp: Date.now(),
              message: `You were added to "${dataOrg.name}"`
            })
          })
        )
      } else {
        const usersSnap = await db.ref("users").get()
        if (usersSnap.exists()) {
          const allUids = Object.keys(usersSnap.val()).filter((u) => u !== uid)
          await Promise.all(
            allUids.map(async (other) => {
              const n = db.ref(`users/${other}/notifications`).push()
              await n.set({
                id: n.key,
                type: "new_public_org",
                orgId,
                timestamp: Date.now(),
                message: `A new organisation "${dataOrg.name}" has been created.`
              })
            })
          )
        }
      }

      return dataOrg
    })
)

/* -------------------------------------------------------------------------- */
/*                       joinOrganization                                     */
/* -------------------------------------------------------------------------- */
export const joinOrganization = onCall(
  (req: CallableRequest<Pick<OrgPayload, "orgId">>) =>
    wrap(async () => {
      const uid = req.auth?.uid
      const orgId = req.data.orgId
      if (!uid) throw new HttpsError("unauthenticated", "Login required")
      if (!orgId) throw new HttpsError("invalid-argument", "Missing orgId")

      const snap = await db.ref(`organizations/${orgId}`).get()
      if (!snap.exists())
        throw new HttpsError("not-found", "Organisation not found")
      const org = snap.val() as Org
      if (org.isPrivate)
        throw new HttpsError(
          "permission-denied",
          "Cannot join a private organisation"
        )

      await db.ref(`organizations/${orgId}/members/${uid}`).set("Member")
      return { success: true }
    })
)

/* -------------------------------------------------------------------------- */
/*                       leaveOrganization                                    */
/* -------------------------------------------------------------------------- */
export const leaveOrganization = onCall(
  (req: CallableRequest<Pick<OrgPayload, "orgId">>) =>
    wrap(async () => {
      const uid = req.auth?.uid
      const orgId = req.data.orgId
      if (!uid) throw new HttpsError("unauthenticated", "Login required")
      if (!orgId) throw new HttpsError("invalid-argument", "Missing orgId")

      const snap = await db.ref(`organizations/${orgId}`).get()
      if (!snap.exists())
        throw new HttpsError("not-found", "Organisation not found")
      const org = snap.val() as Org
      if (!org.members[uid])
        throw new HttpsError("permission-denied", "Not a member")

      const memberIds = Object.keys(org.members)
      if (memberIds.length === 1) {
        if (org.isPrivate) await db.ref(privIdx(uid, orgId)).remove()
        await db.ref(`organizations/${orgId}`).remove()
        return { success: true, deleted: true }
      }

      let transferred = false
      if (org.ownerId === uid) {
        const nextOwner = memberIds.filter((m) => m !== uid).sort()[0]
        await db.ref(`organizations/${orgId}/ownerId`).set(nextOwner)
        await db
          .ref(`organizations/${orgId}/members/${nextOwner}`)
          .set("Admin")
        transferred = true
      }

      await db.ref(`organizations/${orgId}/members/${uid}`).remove()
      if (org.isPrivate) await db.ref(privIdx(uid, orgId)).remove()

      return { success: true, transferred }
    })
)

/* -------------------------------------------------------------------------- */
/*                       addMember                                            */
/* -------------------------------------------------------------------------- */
export const addMember = onCall(
  (req: CallableRequest<Pick<OrgPayload, "orgId" | "userId">>) =>
    wrap(async () => {
      const uid = req.auth?.uid
      const { orgId, userId } = req.data
      if (!uid) throw new HttpsError("unauthenticated", "Login required")
      if (!orgId || !userId)
        throw new HttpsError("invalid-argument", "Missing ids")

      const snap = await db.ref(`organizations/${orgId}`).get()
      if (!snap.exists())
        throw new HttpsError("not-found", "Organisation not found")
      const org = snap.val() as Org
      if (org.ownerId !== uid && org.members[uid] !== "Admin")
        throw new HttpsError("permission-denied", "Admin only")

      await db.ref(`organizations/${orgId}/members/${userId}`).set("Member")
      if (org.isPrivate)
        await db.ref(privIdx(userId, orgId)).set({ role: "Member" })

      const n = db.ref(`users/${userId}/notifications`).push()
      await n.set({
        id: n.key,
        type: "added_to_group",
        orgId,
        fromUserId: uid,
        timestamp: Date.now(),
        message: `You were added to "${org.name}"`
      })

      return { success: true }
    })
)

/* -------------------------------------------------------------------------- */
/*                       removeMember                                         */
/* -------------------------------------------------------------------------- */
export const removeMember = onCall(
  (req: CallableRequest<Pick<OrgPayload, "orgId" | "userId">>) =>
    wrap(async () => {
      const uid = req.auth?.uid
      const { orgId, userId } = req.data
      if (!uid) throw new HttpsError("unauthenticated", "Login required")
      if (!orgId || !userId)
        throw new HttpsError("invalid-argument", "Missing ids")

      const snap = await db.ref(`organizations/${orgId}`).get()
      if (!snap.exists())
        throw new HttpsError("not-found", "Organisation not found")
      const org = snap.val() as Org
      if (org.ownerId !== uid && org.members[uid] !== "Admin")
        throw new HttpsError("permission-denied", "Admin only")
      if (userId === org.ownerId)
        throw new HttpsError("permission-denied", "Cannot remove owner")

      await db.ref(`organizations/${orgId}/members/${userId}`).remove()
      if (org.isPrivate) await db.ref(privIdx(userId, orgId)).remove()
      return { success: true }
    })
)

/* -------------------------------------------------------------------------- */
/*                       deleteOrganization                                   */
/* -------------------------------------------------------------------------- */
export const deleteOrganization = onCall(
  (req: CallableRequest<Pick<OrgPayload, "orgId">>) =>
    wrap(async () => {
      const uid = req.auth?.uid
      const orgId = req.data.orgId
      if (!uid) throw new HttpsError("unauthenticated", "Login required")
      if (!orgId) throw new HttpsError("invalid-argument", "Missing orgId")

      const snap = await db.ref(`organizations/${orgId}`).get()
      if (!snap.exists())
        throw new HttpsError("not-found", "Organisation not found")
      const org = snap.val() as Org
      if (org.ownerId !== uid)
        throw new HttpsError("permission-denied", "Owner only")

      if (org.isPrivate) {
        await Promise.all(
          Object.keys(org.members).map((m) =>
            db.ref(privIdx(m, orgId)).remove()
          )
        )
      }
      await db.ref(`organizations/${orgId}`).remove()
      return { success: true }
    })
)
