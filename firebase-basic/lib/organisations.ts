import { fs, auth } from "@/lib/firebase";
import { 
  addDoc, 
  collection, 
  serverTimestamp, 
  doc, 
  getDoc, 
  updateDoc, 
  arrayUnion,
  query,
  where,
  getDocs
} from "firebase/firestore";

export async function createOrganisation(name: string, description: string) {
  if (!auth.currentUser) throw new Error("User not authenticated");

  const orgData = {
    name,
    description,
    ownerId: auth.currentUser.uid,
    members: [auth.currentUser.uid],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(fs, "organisations"), orgData);
  return docRef.id;
}

export async function getOrganisation(orgId: string) {
  const docRef = doc(fs, "organisations", orgId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    throw new Error("Organisation not found");
  }
  
  return {
    id: docSnap.id,
    ...docSnap.data(),
    members: docSnap.data().members || []
  };
}

export async function joinOrganisation(orgId: string, userId: string) {
  const orgRef = doc(fs, "organisations", orgId);
  await updateDoc(orgRef, {
    members: arrayUnion(userId)
  });
}

export async function getUserOrganisations(userId: string) {
  const q = query(
    collection(fs, "organisations"),
    where("members", "array-contains", userId)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    members: doc.data().members || []
  }));
}