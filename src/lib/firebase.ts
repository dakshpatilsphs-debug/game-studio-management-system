import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

// Firebase configuration provided by the user
export const firebaseConfig = {
  apiKey: "AIzaSyAb9YzNNMUKpDBM5SuWjyuYVkBplO-PuBo",
  authDomain: "game-studio-mange-os.firebaseapp.com",
  projectId: "game-studio-mange-os",
  storageBucket: "game-studio-mange-os.firebasestorage.app",
  messagingSenderId: "415144775622",
  appId: "1:415144775622:web:7f7a9625d978e2581eacc7",
  measurementId: "G-ER6JD3VJM5",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Enable offline persistence so the app keeps working without a connection.
let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch {
  dbInstance = getFirestore(app);
}

export const db = dbInstance;
