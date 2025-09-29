import { onCall, CallableRequest, HttpsError } from "firebase-functions/v2/https";
import { db } from "./firebaseAdmin";

interface FriendPayload {
  targetUserId?: string;
  requestId?: string;
}

// interface FriendRequest {
//   id: string;
//   fromUserId: string;
//   toUserId: string;
//   fromUserName: string;
//   fromUserSurname: string;
//   status: "pending" | "accepted" | "rejected";
//   createdAt: number;
// }

interface UserProfile {
  uid: string;
  name: string;
  surname: string;
  profilePicture?: string;
}

/** Send a friend request */
export const sendFriendRequest = onCall(
  async (req: CallableRequest<Pick<FriendPayload, "targetUserId">>) => {
    const uid = req.auth?.uid;
    const { targetUserId } = req.data;
    
    if (!uid) throw new HttpsError("unauthenticated", "Login required");
    if (!targetUserId) throw new HttpsError("invalid-argument", "Target user ID required");
    if (uid === targetUserId) throw new HttpsError("invalid-argument", "Cannot send request to yourself");

    // Check if users are already friends
    const friendshipRef = db.ref(`users/${uid}/friends/${targetUserId}`);
    const existingFriendship = await friendshipRef.get();
    if (existingFriendship.exists()) {
      throw new HttpsError("already-exists", "Users are already friends");
    }

    // Check if request already exists
    const existingRequestRef = db.ref(`users/${uid}/sentRequests/${targetUserId}`);
    const existingRequest = await existingRequestRef.get();
    if (existingRequest.exists()) {
      throw new HttpsError("already-exists", "Friend request already sent");
    }

    // Get sender's profile
    const senderProfileRef = db.ref(`users/${uid}/UserSettings`);
    const senderProfile = await senderProfileRef.get();
    if (!senderProfile.exists()) {
      throw new HttpsError("not-found", "Sender profile not found");
    }

    const senderData = senderProfile.val();
    const timestamp = Date.now();

    // Create the friend request
    const requestData = {
      fromUserId: uid,
      toUserId: targetUserId,
      fromUserName: senderData.name || "",
      fromUserSurname: senderData.surname || "",
      status: "pending",
      createdAt: timestamp
    };

    // Add to sent requests and incoming requests
    await Promise.all([
      db.ref(`users/${uid}/sentRequests/${targetUserId}`).set(requestData),
      db.ref(`users/${targetUserId}/incomingRequests/${uid}`).set(requestData)
    ]);


    // Send notification to the target user
    const notifRef = db.ref(`users/${targetUserId}/notifications`).push();
    const notificationData = {
      id: notifRef.key,
      type: 'friend_request',
      fromUserId: uid,
      fromUserName: senderData.name || "",
      fromUserSurname: senderData.surname || "",
      timestamp: timestamp,
      message: `${senderData.name} ${senderData.surname} sent you a friend request`,
      read: false
    };
    
    await notifRef.set(notificationData);

    return { success: true, message: "Friend request sent successfully" };
  }
);

/** Accept a friend request */
export const acceptFriendRequest = onCall(
  async (req: CallableRequest<Pick<FriendPayload, "targetUserId">>) => {
    const uid = req.auth?.uid;
    const { targetUserId } = req.data;
    
    if (!uid) throw new HttpsError("unauthenticated", "Login required");
    if (!targetUserId) throw new HttpsError("invalid-argument", "Target user ID required");

    // Verify incoming request exists
    const incomingRequestRef = db.ref(`users/${uid}/incomingRequests/${targetUserId}`);
    const incomingRequest = await incomingRequestRef.get();
    if (!incomingRequest.exists()) {
      throw new HttpsError("not-found", "Friend request not found");
    }

    // Get accepter's profile
    const accepterProfileRef = db.ref(`users/${uid}/UserSettings`);
    const accepterProfile = await accepterProfileRef.get();
    const accepterData = accepterProfile.exists() ? accepterProfile.val() : {};

    // Add to friends lists and remove from requests
    await Promise.all([
      db.ref(`users/${uid}/friends/${targetUserId}`).set(true),
      db.ref(`users/${targetUserId}/friends/${uid}`).set(true),
      db.ref(`users/${uid}/incomingRequests/${targetUserId}`).remove(),
      db.ref(`users/${targetUserId}/sentRequests/${uid}`).remove()
    ]);

    // Send notification to the original sender that their request was accepted
    const notifRef = db.ref(`users/${targetUserId}/notifications`).push();
    const timestamp = Date.now();
    const notificationData = {
      id: notifRef.key,
      type: 'friend_request_accepted', // ← FIXED: Correct type
      fromUserId: uid,
      fromUserName: accepterData.name || "",
      fromUserSurname: accepterData.surname || "",
      timestamp: timestamp,
      message: `${accepterData.name} ${accepterData.surname} accepted your friend request`,
      read: false
    };
    
    await notifRef.set(notificationData);
    
    return { success: true, message: "Friend request accepted" };
  }
);

/** Reject a friend request */
export const rejectFriendRequest = onCall(
  async (req: CallableRequest<Pick<FriendPayload, "targetUserId">>) => {
    const uid = req.auth?.uid;
    const { targetUserId } = req.data;
    
    if (!uid) throw new HttpsError("unauthenticated", "Login required");
    if (!targetUserId) throw new HttpsError("invalid-argument", "Target user ID required");

    // Remove from requests
    await Promise.all([
      db.ref(`users/${uid}/incomingRequests/${targetUserId}`).remove(),
      db.ref(`users/${targetUserId}/sentRequests/${uid}`).remove()
    ]);

    return { success: true, message: "Friend request rejected" };
  }
);

/** Cancel a sent friend request */
export const cancelFriendRequest = onCall(
  async (req: CallableRequest<Pick<FriendPayload, "targetUserId">>) => {
    const uid = req.auth?.uid;
    const { targetUserId } = req.data;
    
    if (!uid) throw new HttpsError("unauthenticated", "Login required");
    if (!targetUserId) throw new HttpsError("invalid-argument", "Target user ID required");

    // Remove from requests
    await Promise.all([
      db.ref(`users/${uid}/sentRequests/${targetUserId}`).remove(),
      db.ref(`users/${targetUserId}/incomingRequests/${uid}`).remove()
    ]);

    return { success: true, message: "Friend request cancelled" };
  }
);

/** Remove a friend */
export const removeFriend = onCall(
  async (req: CallableRequest<Pick<FriendPayload, "targetUserId">>) => {
    const uid = req.auth?.uid;
    const { targetUserId } = req.data;
    
    if (!uid) throw new HttpsError("unauthenticated", "Login required");
    if (!targetUserId) throw new HttpsError("invalid-argument", "Target user ID required");

    // Remove from friends lists
    await Promise.all([
      db.ref(`users/${uid}/friends/${targetUserId}`).remove(),
      db.ref(`users/${targetUserId}/friends/${uid}`).remove()
    ]);

    return { success: true, message: "Friend removed successfully" };
  }
);

/** Get user's friends list */
export const getFriends = onCall(
  async (req: CallableRequest<{}>) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Login required");

    const friendsRef = db.ref(`users/${uid}/friends`);
    const friendsSnapshot = await friendsRef.get();
    
    if (!friendsSnapshot.exists()) {
      return [];
    }

    const friendIds = Object.keys(friendsSnapshot.val());
    const friends: UserProfile[] = [];

    // Get profile data for each friend
    for (const friendId of friendIds) {
      const profileRef = db.ref(`users/${friendId}/UserSettings`);
      const profileSnapshot = await profileRef.get();
      
      if (profileSnapshot.exists()) {
        const profileData = profileSnapshot.val();
        friends.push({
          uid: friendId,
          name: profileData.name || "",
          surname: profileData.surname || "",
          profilePicture: profileData.profilePicture || ""
        });
      }
    }

    return friends;
  }
);

/** Get friend requests (both incoming and sent) */
export const getFriendRequests = onCall(
  async (req: CallableRequest<{}>) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Login required");

    const [incomingSnapshot, sentSnapshot] = await Promise.all([
      db.ref(`users/${uid}/incomingRequests`).get(),
      db.ref(`users/${uid}/sentRequests`).get()
    ]);

    const incoming: UserProfile[] = [];
    const sent: UserProfile[] = [];

    // Process incoming requests
    if (incomingSnapshot.exists()) {
      const incomingData = incomingSnapshot.val();
      for (const fromUserId of Object.keys(incomingData)) {
        const profileRef = db.ref(`users/${fromUserId}/UserSettings`);
        const profileSnapshot = await profileRef.get();
        
        if (profileSnapshot.exists()) {
          const profileData = profileSnapshot.val();
          incoming.push({
            uid: fromUserId,
            name: profileData.name || "",
            surname: profileData.surname || "",
            profilePicture: profileData.profilePicture || ""
          });
        }
      }
    }

    // Process sent requests
    if (sentSnapshot.exists()) {
      const sentData = sentSnapshot.val();
      for (const toUserId of Object.keys(sentData)) {
        const profileRef = db.ref(`users/${toUserId}/UserSettings`);
        const profileSnapshot = await profileRef.get();
        
        if (profileSnapshot.exists()) {
          const profileData = profileSnapshot.val();
          sent.push({
            uid: toUserId,
            name: profileData.name || "",
            surname: profileData.surname || "",
            profilePicture: profileData.profilePicture || ""
          });
        }
      }
    }

    return { incoming, sent };
  }
);