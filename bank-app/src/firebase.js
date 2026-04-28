import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBRuQRvmUXmUBaJdxoWCQIH_ESsfvM6lmw",
  authDomain: "bank-35b8d.firebaseapp.com",
  projectId: "bank-35b8d",
  storageBucket: "bank-35b8d.firebasestorage.app",
  messagingSenderId: "754788688669",
  appId: "1:754788688669:web:846894d30c7c0853d4b7f4",
  measurementId: "G-F23LEHMT39"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);