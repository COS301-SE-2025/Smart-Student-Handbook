import { db } from "@/lib/firebase";
import { ref, set } from "firebase/database";
import { getAuth } from "firebase/auth";

export const sendTestNote = async () => {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    console.error("❌ No user is logged in.");
    return;
  }

  const userID = user.uid;

  const degree = "ComputerScience";
  const module = "AI";
  const year = "2025";
  const tags = "machineLearning";

  const path = `${userID}/Notes/${degree}/${module}/${year}/${tags}`;

  const noteData = {
    title: "Intro to Machine Learning",
    content: "This is a test note stored in Realtime DB.",
    createdAt: new Date().toISOString()
  };

  try {
    await set(ref(db, path), noteData);
    console.log("✅ Note successfully written (or overwritten) to Realtime Database");
  } catch (error) {
    console.error("❌ Failed to write note:", error);
  }
};
