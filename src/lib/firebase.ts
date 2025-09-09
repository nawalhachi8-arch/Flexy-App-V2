// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "API_KEY",
  authDomain: "flexy-app-v2-c7ek.firebaseapp.com",
  projectId: "flexy-app-v2-c7ek",
  storageBucket: "flexy-app-v2-c7ek.appspot.com",
  messagingSenderId: "385551989069",
  appId: "1:385551989069:web:a61172826960f295058728",
  measurementId: "G-RFR52PWV9R"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { db };
