// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyABkJJG7rmzW2-MZB7R9Nc3pWYisyRqTjQ",
  authDomain: "studenthandbook-a215a.firebaseapp.com",
  databaseURL: "https://studenthandbook-a215a-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "studenthandbook-a215a",
  storageBucket: "studenthandbook-a215a.firebasestorage.app",
  messagingSenderId: "115322354821",
  appId: "1:115322354821:web:7a266195595bb59e5c3dec",
  measurementId: "G-SD3YP79L2S"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const fs = getFirestore(app);
const db = getDatabase(app);

export { auth , fs , db };