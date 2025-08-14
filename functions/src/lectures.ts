/**
 * lectures.ts
 * CRUD Cloud Functions for timetable lecture slots.
 */

import { onCall, CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { db } from './firebaseAdmin'

/** Expected payload shapes for the lecture callables */
interface LecturePayload {
  semesterId?: string
  lecture?: any
  lectureId?: string
}

/**
 * getLectures – return all lectures for a given semester
 *
 * @param req.data.semesterId  Semester ID to filter by
 * @returns Array of lecture objects belonging to that semester
 */
export const getLectures = onCall(
  async (req: CallableRequest<Pick<LecturePayload, 'semesterId'>>) => {
    const uid = req.auth?.uid
    const { semesterId } = req.data

    if (!uid) throw new HttpsError('unauthenticated', 'Login required')
    if (!semesterId) throw new HttpsError('invalid-argument', 'semesterId missing')

    const snap = await db.ref(`users/${uid}/lectureSlots`).get()
    const rows = snap.exists() ? Object.values(snap.val()) : []

    return rows.filter((l: any) => l.semesterId === semesterId)
  }
)

/**
 * addLecture – create a new lecture slot
 *
 * Required lecture fields: subject, timeSlot, dayOfWeek
 *
 * @param req.data.semesterId  Semester that owns the lecture
 * @param req.data.lecture     Lecture details
 * @returns Newly created lecture object (with generated id)
 */
export const addLecture = onCall(
  async (
    req: CallableRequest<Pick<LecturePayload, 'lecture' | 'semesterId'>>
  ) => {
    const uid = req.auth?.uid
    const { lecture, semesterId } = req.data

    if (!uid) throw new HttpsError('unauthenticated', 'Login required')
    if (
      !semesterId ||
      !lecture?.subject ||
      !lecture?.timeSlot ||
      typeof lecture?.dayOfWeek !== 'number'
    ) {
      throw new HttpsError('invalid-argument', 'Invalid lecture data')
    }

    const ref = db.ref(`users/${uid}/lectureSlots`).push()
    const newLecture = { ...lecture, semesterId, id: ref.key }

    await ref.set(newLecture)
    return newLecture
  }
)

/**
 * deleteLecture – remove a lecture slot by ID
 *
 * @param req.data.lectureId  ID of the lecture to delete
 * @returns { success: true } on completion
 */
export const deleteLecture = onCall(
  async (req: CallableRequest<Pick<LecturePayload, 'lectureId'>>) => {
    const uid = req.auth?.uid
    const { lectureId } = req.data

    if (!uid) throw new HttpsError('unauthenticated', 'Login required')
    if (!lectureId) throw new HttpsError('invalid-argument', 'lectureId missing')

    await db.ref(`users/${uid}/lectureSlots/${lectureId}`).remove()
    return { success: true }
  }
)
