/**
 * semesters.ts
 * Cloud Functions for CRUD operations on a user’s semesters.
 */

import { onCall, CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { getDatabase } from 'firebase-admin/database'

const db = getDatabase()

/** Shape of the payloads accepted by semester callables */
interface SemPayload {
  semester?: {
    id?: string
    name?: string
    startDate?: string
    endDate?: string
  }
  semesterId?: string
}

/**
 * getSemesters – list all semesters that belong to the current user
 *
 * @returns array of semester objects
 */
export const getSemesters = onCall(async (req: CallableRequest<{}>) => {
  const uid = req.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Login required')

  const snap = await db.ref(`users/${uid}/semesters`).get()
  return snap.exists() ? Object.values(snap.val()!) : []
})

/**
 * addSemester – create a new semester
 *
 * Required fields: name, startDate, endDate
 *
 * @returns the newly created semester object
 */
export const addSemester = onCall(
  async (req: CallableRequest<Pick<SemPayload, 'semester'>>) => {
    const uid = req.auth?.uid
    const sem = req.data.semester

    if (!uid) throw new HttpsError('unauthenticated', 'Login required')
    if (!sem?.name || !sem.startDate || !sem.endDate) {
      throw new HttpsError('invalid-argument', 'Missing semester fields')
    }

    const ref = db.ref(`users/${uid}/semesters`).push()
    const newSem = {
      id: ref.key!,
      name: sem.name.trim(),
      startDate: sem.startDate,
      endDate: sem.endDate,
      isActive: false,
    }

    await ref.set(newSem)
    return newSem
  }
)

/**
 * updateSemester – update name or dates of an existing semester
 *
 * @returns the updated semester object
 */
export const updateSemester = onCall(
  async (req: CallableRequest<Pick<SemPayload, 'semester'>>) => {
    const uid = req.auth?.uid
    const sem = req.data.semester

    if (!uid) throw new HttpsError('unauthenticated', 'Login required')
    if (!sem?.id) throw new HttpsError('invalid-argument', 'Missing semester id')

    const updates: Record<string, unknown> = {}
    if (sem.name) updates.name = sem.name.trim()
    if (sem.startDate) updates.startDate = sem.startDate
    if (sem.endDate) updates.endDate = sem.endDate
    if (Object.keys(updates).length === 0) {
      throw new HttpsError('invalid-argument', 'Nothing to update')
    }

    const ref = db.ref(`users/${uid}/semesters/${sem.id}`)
    const snap = await ref.get()
    if (!snap.exists()) throw new HttpsError('not-found', 'Semester not found')

    await ref.update(updates)
    return (await ref.get()).val()
  }
)

/**
 * setActiveSemester – mark one semester as active, all others inactive
 *
 * @returns { success: true } on completion
 */
export const setActiveSemester = onCall(
  async (req: CallableRequest<Pick<SemPayload, 'semesterId'>>) => {
    const uid = req.auth?.uid
    const semesterId = req.data.semesterId

    if (!uid) throw new HttpsError('unauthenticated', 'Login required')
    if (!semesterId) throw new HttpsError('invalid-argument', 'Missing semesterId')

    const ref = db.ref(`users/${uid}/semesters`)
    const snap = await ref.get()
    if (!snap.exists()) return { success: false }

    const all = snap.val() as Record<string, any>
    const batch: Record<string, boolean> = {}
    for (const id of Object.keys(all)) {
      batch[`${id}/isActive`] = id === semesterId
    }
    await ref.update(batch)
    return { success: true }
  }
)

/**
 * deleteSemester – permanently remove a semester
 *
 * @returns { success: true } on completion
 */
export const deleteSemester = onCall(
  async (req: CallableRequest<Pick<SemPayload, 'semesterId'>>) => {
    const uid = req.auth?.uid
    const semesterId = req.data.semesterId

    if (!uid) throw new HttpsError('unauthenticated', 'Login required')
    if (!semesterId) throw new HttpsError('invalid-argument', 'Missing semesterId')

    await db.ref(`users/${uid}/semesters/${semesterId}`).remove()
    return { success: true }
  }
)
