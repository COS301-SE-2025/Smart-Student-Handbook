import { getAuth } from "firebase/auth";
import { ref, set } from "firebase/database";
import { db } from "@/lib/firebase";

export const addFriend = async (friendUserID: string) => {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User not logged in");
  }

  const userID = user.uid;
  const friendRef = ref(db, `${userID}/Friends/${friendUserID}`);

  try {
    await set(friendRef, true);
    console.log("Friend added:", friendUserID);
  } catch (err) {
    console.error("Error adding friend:", err);
  }
};
