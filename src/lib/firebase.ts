
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAkcuVszamn7laJZ1xWFl6LZQJM6OVg4Ho",
  authDomain: "flexyearn.firebaseapp.com",
  projectId: "flexyearn",
  storageBucket: "flexyearn.firebasestorage.app",
  messagingSenderId: "440741865536",
  appId: "1:440741865536:web:70c96f5f5bfce095fa57a5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
