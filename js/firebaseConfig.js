import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {  initializeFirestore,
 persistentLocalCache,
  persistentMultipleTabManager, } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDCzjAJYvUd65LC5VrkxXFxzMXjNUyevBk",
  authDomain: "storysubmissiontracker.firebaseapp.com",
  projectId: "storysubmissiontracker",
  storageBucket: "storysubmissiontracker.firebasestorage.app",
  messagingSenderId: "976500576183",
  appId: "1:976500576183:web:4956c5e0d189eaf3182232"
};



// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
 localCache: persistentLocalCache({
  tabManager: persistentMultipleTabManager(),
 }),
});