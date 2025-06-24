import * as functions from "firebase-functions/v1";  // Use v1 for CallableContext
import * as admin     from "firebase-admin";

// Initialize Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// Get a Realtime Database reference


type FriendProfile = {
  id:        string;
  name:      string;
  email:     string;
  avatarUrl: string;
};

/**
 * Callable function to list all Auth users (up to 1000)
 * Returns an array of FriendProfile for users with displayName & email
 */
export const listUsers = functions.https.onCall(
  async (
    _data: {},
    context: functions.https.CallableContext  // Now explicitly non-optional
  ): Promise<FriendProfile[]> => {
    // Ensure requester is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be signed in to fetch users."
      );
    }

    // List up to 1000 users from Auth
    const { users } = await admin.auth().listUsers(1000);

    // Filter and shape
    return users
      .filter(u => !!u.email && !!u.displayName)
      .map(u => ({
        id:        u.uid,
        name:      u.displayName!,
        email:     u.email!,
        avatarUrl: u.photoURL  || "",
      }));
  }
);