// src/utils/user.ts
import { ref, set } from "firebase/database"
import { db } from "@/lib/firebase"

/**
 * Initializes /users/{uid} with predictable empty branches so the
 * UI and security-rules never hit “missing path” edge-cases.
 */
export async function initializeNewUser(
  uid: string,
  displayName: string
): Promise<void> {
  const now = Date.now()

  const defaults = {
    UserSettings: {
      name:        displayName,
      surname:     "",
      degree:      "",
      occupation:  "",
      hobbies:     [] as string[],
      description: "",
      createdAt:   now,
    },
    Friends: {},

    /* ─── pre-seeded empty sub-trees ───────────────────────────────────── */
    privateOrganizations: null,
    publicOrganizations:  null,
    calendar: { events: null },
    notifications: null,
  }

  // Single atomic write
  await set(ref(db, `users/${uid}`), defaults)
}

