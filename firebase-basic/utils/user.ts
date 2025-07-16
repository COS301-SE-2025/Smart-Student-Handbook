// src/utils/user.ts
import { ref, set } from "firebase/database"
import { db } from "@/lib/firebase"

/**
 * Initializes a new user under /users/{uid} with:
 *  • UserSettings (seeded with displayName as `name` + empty defaults)
 *  • Friends (empty object)
 */
export async function initializeNewUser(
  uid: string,
  displayName: string
): Promise<void> {
  const defaults = {
    UserSettings: {
      name:        displayName,
      surname:     "",
      degree:      "",
      occupation:  "",
      hobbies:     [] as string[],
      description: "",
    },
    Friends: {},
  }

  // One atomic write for both nodes
  await set(ref(db, `users/${uid}`), defaults)
}
