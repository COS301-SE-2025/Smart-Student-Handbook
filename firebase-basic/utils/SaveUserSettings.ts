import { db } from "@/lib/firebase";
import { ref, set } from "firebase/database";

export const saveUserSettings = async (
  userID: string,
  settings: {
    name: string;
    surname: string;
    degree: string;
    occupation: string;
    hobbies: string[];
    description: string;
  }
) => {
  if (!userID) {
    console.error("❌ No userID provided");
    return;
  }

  const path = `${userID}/UserSettings`;

  try {
    await set(ref(db, path), settings);
    console.log(`User settings saved`);
  } catch (error) {
    console.error("Failed :", error);
  }
};