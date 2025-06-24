import { fs } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export async function createUserProfile(userId: string, email: string) {
  const userRef = doc(fs, "users", userId);
  await setDoc(userRef, {
    email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function getUserProfile(userId: string) {
  const userRef = doc(fs, "users", userId);
  const userDoc = await getDoc(userRef);
  
  if (userDoc.exists()) {
    const data = userDoc.data();
    return { 
      id: userDoc.id, 
      email: data.email || "unknown@example.com" 
    };
  }
  
  return {
    id: userId,
    email: "unknown@example.com"
  };
}